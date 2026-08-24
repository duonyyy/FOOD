from pathlib import Path

import tensorflow as tf


BASE_DIR = Path(__file__).resolve().parent.parent
SAVED_MODEL_PATH = BASE_DIR / "runtime" / "efficientnet_b2_food_saved_model"
OUTPUT_PATH = BASE_DIR / "models" / "classification" / "classifier_b2_finetuned_from_pth_float32.tflite"


def main():
    converter = tf.lite.TFLiteConverter.from_saved_model(str(SAVED_MODEL_PATH))
    converter.optimizations = []
    tflite_model = converter.convert()
    OUTPUT_PATH.write_bytes(tflite_model)
    print(f"Converted: {OUTPUT_PATH}")
    print(f"Size: {len(tflite_model) / (1024 * 1024):.2f} MB")


if __name__ == "__main__":
    main()