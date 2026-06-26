import { test, expect, Page } from "@playwright/test";

async function login(page: Page, email: string, password = "password123") {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

test("front-desk lifecycle: book → check-in → pay → check-out → invoice", async ({ page }) => {
  await login(page, "admin@hotelx.com");

  // Dashboard loads with KPIs
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Occupancy tonight")).toBeVisible();

  // 1) Add a brand-new guest (unique name so the test is repeatable)
  const stamp = String(Date.now()).slice(-6);
  const firstName = "E2E";
  const lastName = `Tester${stamp}`;
  const fullName = `${firstName} ${lastName}`;

  await page.goto("/guests");
  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);
  await page.locator('input[name="email"]').fill(`e2e${stamp}@example.com`);
  await page.getByRole("button", { name: "Add guest" }).click();
  await page.waitForURL("**/guests/**");
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();

  // 2) Create a reservation for that guest (defaults to today → tomorrow)
  await page.goto("/reservations/new");
  await page.locator('select[name="guestId"]').selectOption({ label: fullName });
  await page.getByRole("button", { name: "Create reservation" }).click();
  await page.waitForURL(/\/reservations\/[a-z0-9]+$/);
  await expect(page.getByText("BOOKED").first()).toBeVisible();

  // 3) Check in (assign first available room)
  await expect(page.locator('select[name="roomId"]')).toBeVisible();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByText("CHECKED IN").first()).toBeVisible();

  // Folio should now carry a positive balance (room + tax)
  const balanceRow = page.locator("tr", { hasText: "Balance due" });
  await expect(balanceRow).toBeVisible();
  const balanceText = (await balanceRow.innerText()).replace(/\s+/g, " ");
  expect(balanceText).not.toContain("$0.00");

  // 4) Record a payment (amount is pre-filled with the outstanding balance)
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(
    page.locator("tr", { hasText: "Balance due" }).getByText("$0.00")
  ).toBeVisible();

  // 5) Check out (enabled now that balance is zero)
  await page.getByRole("button", { name: "Check out", exact: true }).click();
  await expect(page.getByText("CHECKED OUT").first()).toBeVisible();

  // 6) Invoice renders with a zero balance and the property name
  await page.getByRole("link", { name: /Invoice/ }).click();
  await page.waitForURL("**/invoice");
  await expect(page.getByText("INVOICE", { exact: true })).toBeVisible();
  await expect(page.getByText("Balance Due")).toBeVisible();
});

test("property switcher re-scopes the whole app", async ({ page }) => {
  await login(page, "admin@hotelx.com");

  const switcher = page.locator('select[name="propertyId"]');
  await expect(switcher).toBeVisible();

  const currentValue = await switcher.inputValue();
  const optionValues = await switcher.locator("option").evaluateAll((opts) =>
    (opts as HTMLOptionElement[]).map((o) => o.value)
  );
  const other = optionValues.find((v) => v !== currentValue);
  expect(other).toBeTruthy();

  // Switching auto-submits and reloads the dashboard for the new property
  await Promise.all([
    page.waitForURL("**/"),
    switcher.selectOption(other!),
  ]);

  await expect(page.locator('select[name="propertyId"]')).toHaveValue(other!);
});

test("housekeeping role cannot reach admin settings", async ({ page }) => {
  await login(page, "housekeeping@hotelx.com");

  await page.goto("/settings");
  // requireRole redirects unauthorized users back to the dashboard
  await expect(page).toHaveURL(/\/(\?denied=1)?$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/don't have permission/i)).toBeVisible();
});
