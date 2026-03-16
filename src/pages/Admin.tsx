import { Button } from "@/components/ui/button";
import { Plus, UserPlus } from "lucide-react";

export default function Admin() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">User management & system settings</p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="bg-card rounded-lg p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-card-foreground mb-4">User Management</h2>
        <div className="text-sm text-card-foreground/60 py-8 text-center">
          User management interface coming next. Add users, assign roles, manage access.
        </div>
      </div>
    </div>
  );
}
