export type NewStaffInput = {
  fullName: string;
  email: string;
  password: string;
};

export type CreateStaffResult = { success: true } | { error: string };

type StaffAccountClient = {
  auth: {
    admin: {
      createUser(attributes: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata: { full_name: string };
      }): Promise<{ data: { user: { id: string } | null }; error: { code?: string } | null }>;
      deleteUser(id: string): Promise<{ error: unknown | null }>;
    };
  };
  from(table: "app_users"): {
    insert(values: { id: string; full_name: string; role: "staff"; is_active: boolean }): PromiseLike<{ error: unknown | null }>;
  };
};

export function validateNewStaff(input: NewStaffInput): string | null {
  if (!input.fullName.trim() || input.fullName.trim().length > 120) {
    return "กรุณากรอกชื่อพนักงานไม่เกิน 120 ตัวอักษร";
  }
  const email = input.email.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "กรุณากรอกอีเมลให้ถูกต้อง";
  }
  if (input.password.length < 8 || input.password.length > 128 || !input.password.trim()) {
    return "กรุณาตั้งรหัสผ่าน 8–128 ตัวอักษร";
  }
  return null;
}

export async function createStaffAccount(client: StaffAccountClient, input: NewStaffInput): Promise<CreateStaffResult> {
  const validationError = validateNewStaff(input);
  if (validationError) {
    return { error: validationError };
  }

  const fullName = input.fullName.trim();
  let userId: string;
  try {
    const { data, error } = await client.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (error || !data.user) {
      if (error?.code === "email_exists" || error?.code === "user_already_exists") {
        return { error: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น" };
      }
      if (error?.code === "weak_password") {
        return { error: "รหัสผ่านไม่ผ่านเงื่อนไขของระบบ กรุณาใช้ตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และสัญลักษณ์" };
      }
      return { error: "สร้างบัญชีพนักงานไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง" };
    }
    userId = data.user.id;
  } catch {
    return { error: "เชื่อมต่อระบบบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }

  try {
    const { error } = await client.from("app_users").insert({ id: userId, full_name: fullName, role: "staff", is_active: true });
    if (!error) {
      return { success: true };
    }
  } catch {
    // Undo only the account created by this request if its staff profile could not be saved.
  }

  try {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (!error) {
      return { error: "บันทึกชื่อพนักงานไม่สำเร็จ กรุณาลองเพิ่มใหม่อีกครั้ง" };
    }
  } catch {
    // Report incomplete cleanup so an administrator can reconcile the account.
  }
  return { error: "สร้างบัญชีแล้ว แต่บันทึกข้อมูลพนักงานไม่สำเร็จ กรุณาติดต่อผู้ดูแลเพื่อตรวจสอบบัญชีก่อนเพิ่มซ้ำ" };
}
