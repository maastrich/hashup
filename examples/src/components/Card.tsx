import React from "react";
import type { User } from "../types/user";

interface CardProps {
  user: User;
  onEdit?: (user: User) => void;
}

export function Card({ user, onEdit }: CardProps) {
  return (
    <div className="card">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {onEdit && <button onClick={() => onEdit(user)}>Edit</button>}
    </div>
  );
}
