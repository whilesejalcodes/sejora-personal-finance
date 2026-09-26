import type { User } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reload } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { refreshUser } from "../../client/src/lib/firebase-auth";

const { getFirebaseAuthMock } = vi.hoisted(() => ({
  getFirebaseAuthMock: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  reload: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: getFirebaseAuthMock,
}));

describe("refreshUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reload).mockReset();
  });

  it("refreshes the ID token after Firebase confirms email verification", async () => {
    const user = {
      emailVerified: false,
      getIdToken: vi.fn().mockResolvedValue("fresh-token"),
    } as unknown as User;
    getFirebaseAuthMock.mockReturnValue({ currentUser: user });
    vi.mocked(reload).mockImplementation(async (candidate) => {
      Object.assign(candidate, { emailVerified: true });
    });

    await expect(refreshUser(user)).resolves.toBe(user);

    expect(reload).toHaveBeenCalledWith(user);
    expect(user.getIdToken).toHaveBeenCalledOnce();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });

  it("does not force-refresh the ID token while the email remains unverified", async () => {
    const user = {
      emailVerified: false,
      getIdToken: vi.fn().mockResolvedValue("existing-token"),
    } as unknown as User;
    getFirebaseAuthMock.mockReturnValue({ currentUser: user });

    await expect(refreshUser(user)).resolves.toBe(user);

    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});