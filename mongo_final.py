import pickle
from flask import Flask, jsonify, request
import pandas as pd
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
import requests
import datetime
import ee
from bson import json_util
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
import os
import json


load_dotenv()

def load_channels():
    try:
        with open('channels.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading channels.json: {e}")
        return []

file_path = 'Final_model_iguess.pkl'
with open(file_path, 'rb') as model_file:
    model = pickle.load(model_file)

app = Flask(__name__)

uri = os.getenv("MONGO_URI")
if not uri:
    raise ValueError("MongoDB URI is not set in the .env file.")

service_account = os.getenv("GEE_SERVICE_ACCOUNT")
key_file = os.getenv("GEE_KEY_FILE")
if not service_account or not key_file:
    raise ValueError("GEE credentials are not set in the .env file.")
credentials = ee.ServiceAccountCredentials(service_account, key_file)
ee.Initialize(credentials)
sentinel2_collection = 'COPERNICUS/S2'

def get_nasa_url(lat, lon):
    target_date = (datetime.datetime.utcnow() - datetime.timedelta(days=3)).strftime("%Y%m%d")
    return (
        f"https://power.larc.nasa.gov/api/temporal/daily/point?"
        f"start={target_date}&end={target_date}&latitude={lat}&longitude={lon}"
        f"&community=re&parameters=T2M%2CRH2M%2CPS&format=json&header=true&time-standard=lst"
    )

# Configuration is now read from channels.json

try:
    client = MongoClient(uri, server_api=ServerApi('1'))
    client.admin.command('ping')
    print("Successfully connected to MongoDB!")
    db = client['DV']
    thingspeak_collection = db['thingspeak']
    nasa_collection = db['nasa_larc']
    gee_collection = db['google_earth_engine']
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    exit()

def process_thingspeak_channel(channel):
    try:
        response = requests.get(channel['url'], timeout=10)
        response.raise_for_status()

        data = response.json()
        feeds = data.get("feeds", [])

        if not feeds:
            print(f"No ThingSpeak data available for {channel['name']}.")
            return None

        channel_id = str(data.get("channel", {}).get("id", ""))

        def extract_farmer_field(header_str, default_farmer="Unknown", default_field="Unknown"):
            parts = header_str.split("/")
            if len(parts) >= 2:
                return parts[-2], parts[-1]
            return default_farmer, default_field

        def parse_values(data_str):
            try:
                values = [float(x) for x in data_str.split("/")]
                if len(values) >= 7:
                    return {
                        "hp": values[0], "m": values[1], "t": values[2], 
                        "c": values[3], "n": values[4], "p": values[5], "k": values[6]
                    }
            except Exception:
                pass
            return None

        # Keep track of which (farmer, field) we have successfully found non-zero data for
        found_targets = set()
        
        for feed in reversed(feeds):
            field1_header = feed.get("field1", "")
            field2_data = feed.get("field2", "")
            field3_header = feed.get("field3", "")
            field4_data = feed.get("field4", "")

            nodes_to_insert = []
            if field1_header and field2_data:
                farmer, field = extract_farmer_field(field1_header, channel.get('name', 'Unknown'), 'A')
                parsed = parse_values(field2_data)
                # Accept data if not all zeros and no negative values
                if parsed and not all(v == 0 for v in parsed.values()) and not any(v < 0 for v in parsed.values()) and (farmer, field) not in found_targets:
                    nodes_to_insert.append((farmer, field, parsed))
                    found_targets.add((farmer, field))

            if field3_header and field4_data:
                farmer, field = extract_farmer_field(field3_header, channel.get('name', 'Unknown'), 'B')
                parsed = parse_values(field4_data)
                # Accept data if not all zeros and no negative values
                if parsed and not all(v == 0 for v in parsed.values()) and not any(v < 0 for v in parsed.values()) and (farmer, field) not in found_targets:
                    nodes_to_insert.append((farmer, field, parsed))
                    found_targets.add((farmer, field))

            for farmer, field, parsed_vals in nodes_to_insert:
                exists = thingspeak_collection.find_one(
                    {"channel_id": channel_id, "farmer": farmer, "field": field, "entry_id": feed["entry_id"]}
                )
                if not exists:
                    new_data = {
                        "channel_id": channel_id,
                        "entry_id": feed["entry_id"],
                        "created_at": feed["created_at"],
                        "timestamp": datetime.datetime.utcnow(),
                        "farmer": farmer,
                        "field": field,
                        **parsed_vals
                    }
                    thingspeak_collection.insert_one(new_data)
                    print(f"Stored valid ThingSpeak data for {farmer}/{field} (entry_id {feed['entry_id']}).")
            
            # If we've found data for both nodes (assuming max 2 nodes per channel), we can stop early
            if len(found_targets) >= 2:
                break

    except Exception as e:
        print("ThingSpeak Error:", e)

def fetch_all_thingspeak_data():
    channels = load_channels()
    for ch in channels:
        process_thingspeak_channel(ch)

def fetch_and_store_nasa_data():
    channels = load_channels()
    for ch in channels:
        locations = ch.get("locations", {})
        for farmer, fields in locations.items():
            for field, coords in fields.items():
                lat = coords.get("lat")
                lon = coords.get("lon")
                if lat is None or lon is None:
                    continue

                try:
                    url = get_nasa_url(lat, lon)
                    response = requests.get(url, timeout=15)
                    response.raise_for_status()

                    data = response.json()
                    parameters = data.get("properties", {}).get("parameter", {})
                    target_date = (datetime.datetime.utcnow() - datetime.timedelta(days=3)).strftime("%Y%m%d")

                    latest_doc = nasa_collection.find_one(
                        {"farmer": farmer, "field": field},
                        sort=[("timestamp", -1)]
                    )

                    t2m = parameters.get("T2M", {}).get(target_date, "N/A")
                    rh2m = parameters.get("RH2M", {}).get(target_date, "N/A")
                    ps = parameters.get("PS", {}).get(target_date, "N/A")

                    if latest_doc:
                        if t2m == "N/A": t2m = latest_doc.get("T2M", "N/A")
                        if rh2m == "N/A": rh2m = latest_doc.get("RH2M", "N/A")
                        if ps == "N/A": ps = latest_doc.get("PS", "N/A")

                    new_data = {
                        "farmer": farmer,
                        "field": field,
                        "T2M": t2m,
                        "RH2M": rh2m,
                        "PS": ps,
                        "date": target_date,
                        "timestamp": datetime.datetime.utcnow()
                    }

                    if latest_doc:
                        if (
                            latest_doc.get("T2M") == new_data["T2M"]
                            and latest_doc.get("RH2M") == new_data["RH2M"]
                            and latest_doc.get("PS") == new_data["PS"]
                        ):
                            print(f"NASA data unchanged for {farmer}/{field}.")
                            continue

                    nasa_collection.insert_one(new_data)
                    print(f"NASA data stored successfully for {farmer}/{field}.")

                except Exception as e:
                    print(f"NASA Error for {farmer}/{field}:", e)

def fetch_and_store_gee_data(radius=10, days_back=30):
    channels = load_channels()
    for ch in channels:
        locations = ch.get("locations", {})
        for farmer, fields in locations.items():
            for field, coords in fields.items():
                lat = coords.get("lat")
                lon = coords.get("lon")
                if lat is None or lon is None:
                    continue

                try:
                    point = ee.Geometry.Point([lon, lat])
                    buffer = point.buffer(radius * 1000)

                    end_date = datetime.datetime.utcnow()
                    start_date = end_date - datetime.timedelta(days=days_back)

                    latest_doc = gee_collection.find_one(
                        {"farmer": farmer, "field": field},
                        sort=[("timestamp", -1)]
                    )

                    s2 = (
                        ee.ImageCollection(sentinel2_collection)
                        .filterBounds(buffer)
                        .filterDate(
                            start_date.strftime("%Y-%m-%d"),
                            end_date.strftime("%Y-%m-%d")
                        )
                        .sort("system:time_start", False)
                    )

                    if s2.size().getInfo() == 0:
                        print(f"No Sentinel image found for {farmer}/{field}.")
                        continue

                    image = s2.first().divide(10000)

                    def add_indices(img):
                        NIR = img.select("B8")
                        RED = img.select("B4")
                        GREEN = img.select("B3")
                        BLUE = img.select("B2")
                        RED_EDGE = img.select("B5")
                        SWIR1 = img.select("B11")
                        SWIR2 = img.select("B12")

                        return img.addBands([
                            NIR.subtract(RED).divide(NIR.add(RED)).rename("NDVI"),
                            img.expression("2.5*((NIR-RED)/(NIR+6*RED-7.5*BLUE+1.0001))", {"NIR":NIR,"RED":RED,"BLUE":BLUE}).rename("EVI"),
                            img.expression("(1/GREEN)-(1/RED_EDGE)", {"GREEN":GREEN,"RED_EDGE":RED_EDGE}).rename("ARI"),
                            img.expression("0.5*((SWIR1+SWIR2)-NIR)", {"SWIR1":SWIR1,"SWIR2":SWIR2,"NIR":NIR}).rename("CAI"),
                            NIR.divide(RED_EDGE).subtract(1).rename("CIRE"),
                            NIR.divide(SWIR1).rename("DWSI"),
                            NIR.divide(GREEN).subtract(1).rename("GCVI"),
                            img.expression("((RE-RED)-0.2*(RE-GREEN))*(RE/RED)", {"RE":RED_EDGE,"RED":RED,"GREEN":GREEN}).rename("MCARI"),
                            img.expression("(NIR-BLUE)/(NIR-RED)", {"NIR":NIR,"BLUE":BLUE,"RED":RED}).rename("SIPI")
                        ])

                    image = add_indices(image)

                    sample_collection = image.sample(
                        region=point,
                        scale=10,
                        numPixels=1
                    )

                    if sample_collection.size().getInfo() == 0:
                        print(f"Sampling failed for {farmer}/{field}.")
                        continue

                    sample = sample_collection.first()

                    indices = sample.toDictionary().getInfo()

                    required = {}
                    keys = ["NDVI", "EVI", "ARI", "CAI", "CIRE", "DWSI", "GCVI", "MCARI", "SIPI"]

                    for key in keys:
                        value = indices.get(key)
                        if value is None or value == "N/A":
                            if latest_doc:
                                value = latest_doc.get(key)
                        required[key] = value

                    required["farmer"] = farmer
                    required["field"] = field
                    required["timestamp"] = datetime.datetime.utcnow()

                    if latest_doc:
                        same = True
                        for key in keys:
                            if latest_doc.get(key) != required.get(key):
                                same = False
                                break
                        if same:
                            print(f"GEE values unchanged for {farmer}/{field}.")
                            continue

                    gee_collection.insert_one(required)
                    print(f"GEE values stored successfully for {farmer}/{field}.")

                except Exception as e:
                    print(f"GEE Error for {farmer}/{field}:", e)
    
@app.route("/")
def home():

    return jsonify({

        "status":"Running",
        "ThingSpeak":"OK",
        "NASA":"OK",
        "GEE":"OK"

    })

@app.route('/get_all_data', methods=['GET'])
def get_all_data():
    farmer_query = request.args.get('farmer')
    field_query = request.args.get('field')

    pipeline = []
    
    match_stage = {}
    if farmer_query:
        match_stage["farmer"] = farmer_query
    if field_query:
        match_stage["field"] = field_query
        
    if match_stage:
        pipeline.append({"$match": match_stage})

    pipeline.extend([
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": {"farmer": "$farmer", "field": "$field"},
            "latest": {"$first": "$$ROOT"}
        }}
    ])

    # Fetch ThingSpeak, NASA, and GEE data
    ts_results = list(thingspeak_collection.aggregate(pipeline))
    nasa_results = list(nasa_collection.aggregate(pipeline))
    gee_results = list(gee_collection.aggregate(pipeline))

    # Helper function to format grouped results
    def format_grouped(results):
        formatted = {}
        for res in results:
            if not res["_id"]: continue
            farmer = res["_id"].get("farmer")
            field = res["_id"].get("field")
            if not farmer or not field: continue
            if farmer not in formatted:
                formatted[farmer] = {}
            formatted[farmer][field] = {
                k: v for k, v in res["latest"].items() if k not in ['_id']
            }
        return formatted

    response_data = {
        "ThingSpeak Data": format_grouped(ts_results) or "No Data Available",
        "NASA LaRC Data": format_grouped(nasa_results) or "No Data Available",
        "GEE Data": format_grouped(gee_results) or "No Data Available"
    }
    return json_util.dumps(response_data), 200

def scheduled_fetch_gee_data():
    fetch_and_store_gee_data()

scheduler = BackgroundScheduler()
scheduler.add_job(fetch_all_thingspeak_data, 'interval', hours=1)
scheduler.add_job(
    fetch_and_store_nasa_data,
    trigger="cron",
    hour=8,
    minute=0
)
scheduler.add_job(
    scheduled_fetch_gee_data,
    trigger="cron",
    hour=8,
    minute=15
)
if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
    scheduler.start()

@app.route('/predict', methods=['GET'])
def make_prediction():
    try:
        farmer = request.args.get("farmer")
        field = request.args.get("field")

        if not farmer or not field:
            return jsonify({
                "error": "farmer and field parameters are required"
            }), 400

        thingspeak_data = thingspeak_collection.find_one(
            {"farmer": farmer, "field": field},
            sort=[("timestamp", -1)]
        )

        nasa_data = nasa_collection.find_one(
            {"farmer": farmer, "field": field},
            sort=[("timestamp", -1)]
        )

        gee_data = gee_collection.find_one(
            {"farmer": farmer, "field": field},
            sort=[("timestamp", -1)]
        )

        if not thingspeak_data:
            return jsonify({
                "error": f"ThingSpeak data unavailable for {farmer}/{field}."
            }), 404

        if not nasa_data:
            return jsonify({
                "error": "NASA data unavailable."
            }), 404

        if not gee_data:
            return jsonify({
                "error": "GEE data unavailable."
            }), 404

        feature_data = {
            "T2M": nasa_data["T2M"],
            "RH2M": nasa_data["RH2M"],
            "PS": nasa_data["PS"],
            "ARI": gee_data["ARI"],
            "CAI": gee_data["CAI"],
            "CIRE": gee_data["CIRE"],
            "DWSI": gee_data["DWSI"],
            "EVI": gee_data["EVI"],
            "GCVI": gee_data["GCVI"],
            "MCARI": gee_data["MCARI"],
            "SIPI": gee_data["SIPI"],
            "pH": thingspeak_data.get("hp", 7.0),
            "Temperature (Centigrate)": thingspeak_data.get("t", 25.0),
            "EC (microsiemens per cm)": thingspeak_data.get("c", 1.0)
        }

        # The model expects these exact columns in this exact order
        columns = [
            'T2M', 'RH2M', 'PS', 'ARI', 'CAI', 'CIRE', 'DWSI', 'EVI', 'GCVI', 'MCARI', 'SIPI',
            'pH', 'Temperature (Centigrate)', 'EC (microsiemens per cm)'
        ]
        
        predict_df = pd.DataFrame([feature_data], columns=columns)
        prediction = model.predict(predict_df)

        result = {
            "N": float(prediction[0][0]),
            "P": float(prediction[0][1]),
            "K": float(prediction[0][2])
        }

        return jsonify({
            "farmer": farmer,
            "field": field,
            "prediction": result,
            "input_features": feature_data
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

if __name__ == '__main__':
    fetch_all_thingspeak_data()
    fetch_and_store_nasa_data()
    fetch_and_store_gee_data()
    app.run(
        host="0.0.0.0",
        port=5050,
        debug=True,
        use_reloader=False
    )


