import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@saas.local';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return;
  }

  const workspace = await prisma.workspace.create({
    data: { name: 'Demo Workspace' },
  });

  const password = await bcrypt.hash('Demo12345!', 10);

  await prisma.user.create({
    data: {
      email,
      name: 'Demo User',
      password,
      workspaceId: workspace.id,
      emailVerifiedAt: new Date(),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
