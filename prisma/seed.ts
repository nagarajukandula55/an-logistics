import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name: "AN Logistics Admin",
      email,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log("Seeded admin user:");
  console.log(`  username: ${email}`);
  console.log(`  password: ${password}`);
  console.log("Sign in and change this password immediately — it is a placeholder.");
  console.log("Set SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD env vars to seed a different account.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
