"""MedGuard bottle-label vision: read a real supplement/med bottle photo with Bedrock Nova Pro
and extract the product name (to seed the label search) + expiry if printed. Fail-closed: if the
label is not legibly readable, readable=False and the user is asked to retake or type the name.

The model reads the label text ONLY; it never guesses a product that isn't legible, and identity is
still confirmed against the NIH DSLD catalog by the user. No loose-pill identification.
"""
from __future__ import annotations

import asyncio
import os
from io import BytesIO
from typing import Any

from pydantic import BaseModel, Field

MODEL_ID = "us.amazon.nova-pro-v1:0"
REGION = os.environ.get("AWS_REGION", "us-west-2")


class LabelReading(BaseModel):
    """Structured read of a supplement/medicine BOTTLE LABEL. Text only, no guessing."""

    readable: bool = Field(description="True only if the product/brand text on the label is legible.")
    product: str = Field(default="", max_length=120, description="Product name as printed, e.g. 'Fish Oil'. Empty if not legible.")
    brand: str = Field(default="", max_length=120, description="Brand/manufacturer as printed. Empty if not legible.")
    expiry: str = Field(default="", max_length=40, description="Expiry/best-by date exactly as printed, if visible. Empty otherwise.")
    is_loose_pill: bool = Field(default=False, description="True if the image is loose pills/tablets, not a labeled bottle.")
    note: str = Field(default="", max_length=200, description="If not readable, a short retake instruction.")


def normalize_photo(raw: bytes) -> bytes:
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(BytesIO(raw), formats=["JPEG", "PNG"]) as source:
            if source.width * source.height > 30_000_000 or min(source.size) < 40:
                raise ValueError("Image dimensions are out of range.")
            source.load()
            photo = ImageOps.exif_transpose(source).convert("RGB")
            photo.thumbnail((1600, 1600))
            out = BytesIO()
            photo.save(out, format="JPEG", quality=90)
            return out.getvalue()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("The upload is not a readable JPEG or PNG photo.") from exc


def read_label(raw_image: bytes, *, profile: str = "default") -> dict[str, Any]:
    photo = normalize_photo(raw_image)

    async def run() -> LabelReading:
        import boto3
        from strands import Agent
        from strands.models import BedrockModel
        from strands.types.content import ContentBlock

        model = BedrockModel(
            boto_session=boto3.Session(profile_name=os.environ.get("AWS_PROFILE") or None, region_name=REGION),
            model_id=MODEL_ID,
        )
        agent = Agent(
            model=model,
            system_prompt=(
                "You read the printed text on a medicine or dietary-supplement BOTTLE LABEL. "
                "Report ONLY what is legibly printed. Never guess a product that is not clearly readable. "
                "If the image shows loose pills/tablets (no labeled bottle), set is_loose_pill=true and "
                "readable=false. If the label text is blurry, cropped, or absent, set readable=false and "
                "give a short retake instruction. Do not diagnose or infer contents beyond the printed label."
            ),
            callback_handler=None,
        )
        prompt: list[ContentBlock] = [
            {"image": {"format": "jpeg", "source": {"bytes": photo}}},
            {"text": "Read this bottle label. Return the product name, brand, and expiry exactly as printed. "
                     "If it is not a legible labeled bottle, set readable=false with a retake instruction."},
        ]
        result = await asyncio.wait_for(
            agent.invoke_async(prompt, structured_output_model=LabelReading), timeout=60
        )
        return LabelReading.model_validate(result.structured_output)

    reading = asyncio.run(run())
    # Fail-closed shaping for the UI: only offer a search query when we truly read a product.
    query = (f"{reading.product} {reading.brand}").strip() if reading.readable and reading.product else ""
    if reading.is_loose_pill:
        note = "That looks like loose pills. For your safety MedGuard won't guess — scan the labeled bottle."
    elif not reading.readable:
        note = reading.note or "Couldn't read the label clearly. Retake in good light, or type the name."
    else:
        note = ""
    return {
        "readable": bool(reading.readable and query),
        "query": query,
        "product": reading.product,
        "brand": reading.brand,
        "expiry": reading.expiry,
        "is_loose_pill": reading.is_loose_pill,
        "note": note,
        "source": "Bedrock Nova Pro vision (live)",
    }


if __name__ == "__main__":
    import sys

    data = open(sys.argv[1], "rb").read()
    import json

    print(json.dumps(read_label(data), indent=1))
