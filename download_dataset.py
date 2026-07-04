import kagglehub

print("Downloading mahmoudshaheen1134/ambulance-dataset...")
try:
    path = kagglehub.dataset_download("mahmoudshaheen1134/ambulance-dataset")
    print("SUCCESS")
    print("Path to dataset files:", path)
except Exception as e:
    print("ERROR:", e)
