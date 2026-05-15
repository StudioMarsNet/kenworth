import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const eventId = formData.get("event_id") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No se proporcionó imagen" }, { status: 400 });
    }

    // Allowed formats
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png", "webp", "pdf"].includes(ext || "")) {
      return NextResponse.json({ success: false, error: "Formato no permitido. Use JPG, PNG, WEBP o PDF" }, { status: 400 });
    }

    // Convert to buffer → base64 data URI for Cloudinary upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`;
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Upload to Cloudinary into the Kenworth folder
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "02. Kenworth Bajio/rescates",
      resource_type: ext === "pdf" ? "raw" : "image",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      tags: ["rescate", "evidencia", "kenworth"],
    });

    const imageUrl = uploadResult.secure_url;

    // If event_id provided, update the event record
    if (eventId) {
      await query("UPDATE rescue_events SET imagen_url = ? WHERE id = ?", [imageUrl, eventId]);
    }

    return NextResponse.json({
      success: true,
      data: {
        url: imageUrl,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
      }
    });
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
