import platform
import sys
from pathlib import Path

print("=" * 50)
print(" MuleNet: IBM LinuxONE Environment Verification")
print("=" * 50)
print("Machine Architecture:", platform.machine())
print("Operating System    :", platform.system(), platform.release())
print("Python Version      :", sys.version.split()[0])

if platform.machine() == "s390x":
    print("\n✅ Hardware: Running on IBM LinuxONE / s390x (Mainframe Architecture)")
else:
    print(f"\nℹ️  Hardware: Running on {platform.machine()} (Development / Workstation Environment)")

# Verify ONNX model inference
try:
    import numpy as np
    import onnxruntime as ort

    model_path = Path("artifacts/model.onnx")
    if model_path.is_file():
        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        dummy_input = np.zeros((1, 114), dtype=np.float32)
        input_name = session.get_inputs()[0].name
        output = session.run(None, {input_name: dummy_input})
        print("✅ ONNX Model Check : artifacts/model.onnx successfully loaded")
        print(f"✅ Real-Time Scoring: 114-feature dummy test inference score = {float(output[1][0, 1]):.4f}")
    else:
        print("⚠️  ONNX Model Check : artifacts/model.onnx not found")
except Exception as e:
    print("⚠️  ONNX Model Check :", e)

print("=" * 50)
