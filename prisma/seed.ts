import { PrismaClient, TenantType, TenantStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Seeds the two baseline tenants and backfills any existing rows onto the
// internal "angroup" tenant, so single-tenant data created before the
// Tenant model existed doesn't become orphaned/invisible once tenant
// scoping is enforced in the server actions.
async function seedTenantsAndBackfill() {
  const internal = await prisma.tenant.upsert({
    where: { slug: "angroup" },
    update: {},
    create: { slug: "angroup", name: "AN Group", type: TenantType.INTERNAL, status: TenantStatus.ACTIVE },
  });

  await prisma.tenant.upsert({
    where: { slug: "marketplace" },
    update: {},
    create: { slug: "marketplace", name: "Public Marketplace", type: TenantType.MARKETPLACE, status: TenantStatus.ACTIVE },
  });

  const [users, orders, vehicles, drivers, warehouses, customers] = await Promise.all([
    prisma.user.updateMany({ where: { tenantId: null }, data: { tenantId: internal.id } }),
    prisma.order.updateMany({ where: { tenantId: null }, data: { tenantId: internal.id } }),
    prisma.vehicle.updateMany({ where: { tenantId: null }, data: { tenantId: internal.id } }),
    prisma.driver.updateMany({ where: { tenantId: null }, data: { tenantId: internal.id } }),
    prisma.warehouse.updateMany({ where: { tenantId: null }, data: { tenantId: internal.id } }),
    prisma.customer.updateMany({ where: { tenantId: null }, data: { tenantId: internal.id } }),
  ]);

  console.log(
    `Backfilled onto "angroup" tenant — users: ${users.count}, orders: ${orders.count}, vehicles: ${vehicles.count}, drivers: ${drivers.count}, warehouses: ${warehouses.count}, customers: ${customers.count}`
  );
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return;
  }

  const internal = await prisma.tenant.findUnique({ where: { slug: "angroup" } });
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name: "AN Logistics Admin",
      email,
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: internal?.id,
    },
  });

  console.log("Seeded admin user:");
  console.log(`  username: ${email}`);
  console.log(`  password: ${password}`);
  console.log("Sign in and change this password immediately — it is a placeholder.");
  console.log("Set SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD env vars to seed a different account.");
}

async function main() {
  await seedTenantsAndBackfill();
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
