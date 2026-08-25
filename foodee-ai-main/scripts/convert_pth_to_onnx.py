from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models


BASE_DIR = Path(__file__).resolve().parent.parent
CHECKPOINT_PATH = BASE_DIR / "models" / "classification" / "best_efficientnet_b2_30vnfoods_finetuned.pth"
if not CHECKPOINT_PATH.exists():
    CHECKPOINT_PATH = BASE_DIR / "best_efficientnet_b2_30vnfoods_finetuned.pth"
OUTPUT_PATH = BASE_DIR / "runtime" / "efficientnet_b2_food.onnx"


class NHWCModel(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, inputs):
        return self.model(inputs.permute(0, 3, 1, 2))


def main():
    # Load model weights safely with weights_only=True to prevent arbitrary code execution
    checkpoint = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=True)
    class_count = checkpoint["num_classes"]

    model = models.efficientnet_b2(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4),
        nn.Linear(model.classifier[1].in_features, class_count),
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    model = NHWCModel(model)
    model.eval()

    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    sample_input = torch.zeros(1, checkpoint["img_size"], checkpoint["img_size"], 3)
    torch.onnx.export(
        model,
        sample_input,
        OUTPUT_PATH,
        input_names=["input"],
        output_names=["logits"],
        opset_version=18,
        dynamo=False,
    )

    print(f"Exported: {OUTPUT_PATH}")
    print(f"Input shape: {list(sample_input.shape)}")
    print(f"Output classes: {class_count}")


if __name__ == "__main__":
    main()