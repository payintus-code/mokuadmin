import assert from "node:assert/strict";
import test from "node:test";
import { createStaffAccount, validateNewStaff } from "../lib/staff-account.ts";

const validInput = { fullName: "  พนักงานใหม่  ", email: " STAFF@example.com ", password: "  StrongPass1!  " };

function accountClient(options: { authCode?: string; profileFails?: boolean; profileThrows?: boolean; cleanupFails?: boolean } = {}) {
  const created: unknown[] = [];
  const profiles: unknown[] = [];
  const deleted: string[] = [];
  return {
    created, profiles, deleted,
    client: {
      auth: {
        admin: {
          async createUser(attributes: unknown) {
            created.push(attributes);
            return options.authCode
              ? { data: { user: null }, error: { code: options.authCode } }
              : { data: { user: { id: "new-staff-id" } }, error: null };
          },
          async deleteUser(id: string) {
            deleted.push(id);
            return { error: options.cleanupFails ? new Error("cleanup failed") : null };
          }
        }
      },
      from(table: string) {
        assert.equal(table, "app_users");
        return {
          async insert(profile: unknown) {
            profiles.push(profile);
            if (options.profileThrows) throw new Error("network failure");
            return { error: options.profileFails ? new Error("write failed") : null };
          }
        };
      }
    }
  };
}

test("new staff can log in immediately and is listed with staff privileges", async () => {
  const run = accountClient();
  assert.deepEqual(await createStaffAccount(run.client, validInput), { success: true });
  assert.deepEqual(run.created, [{ email: "staff@example.com", password: validInput.password, email_confirm: true, user_metadata: { full_name: "พนักงานใหม่" } }]);
  assert.deepEqual(run.profiles, [{ id: "new-staff-id", full_name: "พนักงานใหม่", role: "staff", is_active: true }]);
  assert.deepEqual(run.deleted, []);
});

test("invalid names, emails and passwords never create an account", async () => {
  for (const input of [
    { ...validInput, fullName: "   " },
    { ...validInput, fullName: "x".repeat(121) },
    { ...validInput, email: "invalid" },
    { ...validInput, email: "staff name@example.com" },
    { ...validInput, password: "short" },
    { ...validInput, password: "        " },
    { ...validInput, password: "x".repeat(129) }
  ]) {
    const run = accountClient();
    assert.ok("error" in await createStaffAccount(run.client, input));
    assert.equal(run.created.length, 0);
  }
  assert.equal(validateNewStaff(validInput), null);
});

test("duplicate email preserves existing accounts and reports an actionable error", async () => {
  for (const authCode of ["email_exists", "user_already_exists"]) {
    const run = accountClient({ authCode });
    const result = await createStaffAccount(run.client, validInput);
    assert.ok("error" in result);
    assert.match(result.error, /อีเมลนี้มีบัญชีอยู่แล้ว/);
    assert.equal(run.profiles.length, 0);
    assert.deepEqual(run.deleted, []);
  }
});

test("password policy rejection creates no staff profile", async () => {
  const run = accountClient({ authCode: "weak_password" });
  const result = await createStaffAccount(run.client, validInput);
  assert.ok("error" in result);
  assert.match(result.error, /รหัสผ่าน/);
  assert.equal(run.profiles.length, 0);
  assert.deepEqual(run.deleted, []);
});

test("failed profile write removes only the account created in this request", async () => {
  for (const options of [{ profileFails: true }, { profileThrows: true }]) {
    const run = accountClient(options);
    const result = await createStaffAccount(run.client, validInput);
    assert.ok("error" in result);
    assert.match(result.error, /ลองเพิ่มใหม่/);
    assert.deepEqual(run.deleted, ["new-staff-id"]);
  }
});

test("failed rollback tells the administrator to reconcile before retrying", async () => {
  const run = accountClient({ profileFails: true, cleanupFails: true });
  const result = await createStaffAccount(run.client, validInput);
  assert.ok("error" in result);
  assert.match(result.error, /ตรวจสอบบัญชีก่อนเพิ่มซ้ำ/);
});

test("account connection failure returns no internal error or password", async () => {
  const run = accountClient();
  run.client.auth.admin.createUser = async () => { throw new Error(validInput.password); };
  const result = await createStaffAccount(run.client, validInput);
  assert.ok("error" in result);
  assert.ok(!result.error.includes(validInput.password));
  assert.equal(run.profiles.length, 0);
  assert.deepEqual(run.deleted, []);
});
