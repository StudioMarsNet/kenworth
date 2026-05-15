import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  display_name: z.string().min(1).max(100),
  role: z.enum(["admin", "vendedor", "almacenista", "gerente", "user"]).default("user"),
});

const UpdateUserSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  role: z.enum(["admin", "vendedor", "almacenista", "gerente", "user"]).optional(),
  password: z.string().min(6).max(100).optional(),
});

function getCallerRole(request: NextRequest): string | null {
  const cookie = request.cookies.get("user_info")?.value;
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie)).role;
  } catch {
    return null;
  }
}

// GET all users (admin and gerente)
export async function GET(request: NextRequest) {
  const role = getCallerRole(request);
  if (role !== "admin" && role !== "gerente") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const users = await query(
      "SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC"
    );
    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST create user (admin and gerente)
export async function POST(request: NextRequest) {
  const role = getCallerRole(request);
  if (role !== "admin" && role !== "gerente") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = CreateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { username, password, display_name, role: userRole } = parsed.data;

    // Check unique username
    const existing: any[] = await query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "El nombre de usuario ya existe" },
        { status: 400 }
      );
    }

    const password_hash = await bcrypt.hash(password, 10);

    await query(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
      [username, password_hash, display_name, userRole]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
