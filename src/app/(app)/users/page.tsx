import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserRow } from "./UserRow";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/orders");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Accounts that can sign in to AN Logistics. Reset a password to force a temporary one on next login."
      />

      {users.length === 0 ? (
        <EmptyState kind="empty" title="No users yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-3">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} currentUserId={session.user.id} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
