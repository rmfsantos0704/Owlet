export type Account = {
  email: string;
  age?: number;
  occupation?: string;
  pendingEmail: string | null;
  createdAt: string;
  termsVersion: string | null;
};

export type Ownedcollection = {
  id: string;
  name: string;
  isDefault: boolean;
  members: { userId: string; email: string; role: string }[];
};

export type AccountData = { account: Account; ownedcollections: Ownedcollection[] };