import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

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

// PUT update user (admin and gerente)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getCallerRole(request);
  if (role !== "admin" && role !== "gerente") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const fields = parsed.data;
    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    // Check user exists
    const existing: any[] = await query("SELECT id FROM users WHERE id = ?", [id]);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    if (fields.display_name !== undefined) {
      setClauses.push("display_name = ?");
      values.push(fields.display_name);
    }
    if (fields.role !== undefined) {
      setClauses.push("role = ?");
      values.push(fields.role);
    }
    if (fields.password !== undefined) {
      const hash = await bcrypt.hash(fields.password, 10);
      setClauses.push("password_hash = ?");
      values.push(hash);
    }

    values.push(id);

    await query(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE user (admin only, cannot delete self)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = getCallerRole(request);
  if (role !== "admin") {
    return NextResponse.json({ success: false, error: "No autorizado. Solo admin puede eliminar usuarios." }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Get caller's ID from cookie to prevent self-delete
    const cookie = request.cookies.get("user_info")?.value;
    if (cookie) {
      try {
        const caller = JSON.parse(decodeURIComponent(cookie));
        if (String(caller.id) === id) {
          return NextResponse.json(
            { success: false, error: "No puedes eliminarte a ti mismo" },
            { status: 400 }
          );
        }
      } catch {}
    }

    const result: any = await query("DELETE FROM users WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
