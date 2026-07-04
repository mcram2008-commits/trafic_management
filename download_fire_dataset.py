import kagglehub

try:
    print("Downloading Indian Emergency Vehicles Dataset...")
    path = kagglehub.dataset_download("ganeshmoh/indian-emergency-vehicles-dataset")
    print("Path to dataset files:", path)
except Exception as e:
    print("Failed to download ganeshmoh/indian-emergency-vehicles-dataset:", e)
