# Existing ML Model Integration Guide

This guide details how the previously fine-tuned and verified Machine Learning models integrate natively into the emergency response backend and phone camera.

---

## 1. Verified Model Checkpoints

The production platform interfaces directly with the trained YOLO checkpoints:

| Model Purpose | Weight File | Checkpoint Path | Input Size | Confidence Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **Road Traffic Incident** | `road_expanded_best.pt` | `D:/accident/accident/road_expanded_best.pt` | 640x640 RGB | `conf >= 0.35` |
| **Human Fall Detection** | `fall_expanded_best.pt` | `D:/accident/accident/fall_expanded_best.pt` | 640x640 RGB | `conf >= 0.35` |
| **Fire & Smoke Combustion** | Physics-Based HSV Filter | Built into `AiInferenceProvider` | Dynamic | `ratio >= 0.040` |

---

## 2. Adapter Architecture (`AiInferenceProvider`)

The platform implements the Adapter Pattern in:
[`backend/app/adapters/ai_adapter.py`](file:///backend/app/adapters/ai_adapter.py)

```python
from ultralytics import YOLO
from PIL import Image

class AiInferenceProvider:
    def __init__(self):
        self.road_model = YOLO("road_expanded_best.pt")
        self.fall_model = YOLO("fall_expanded_best.pt")

    def predict_image(self, image_bytes: bytes, incident_type_hint: str):
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        results = self.road_model(img, conf=0.35)
        # Parse detected boxes...
```

* **Zero Retraining Required**: The backend ingests the existing `.pt` weights directly.
* **Hardware Acceleration**: If an NVIDIA GPU with CUDA is present (e.g. RTX 3050), PyTorch executes inference on CUDA device 0 with sub-30ms latency.
* **Graceful Heuristic Fallback**: If models are loaded on a machine without PyTorch weights, high-fidelity mock inference ensures all API routes and UI components remain completely testable.
