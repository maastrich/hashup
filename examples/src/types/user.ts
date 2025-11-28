export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export type UserRole = "admin" | "user" | "guest";

export interface UserWithRole extends User {
  role: UserRole;
}
