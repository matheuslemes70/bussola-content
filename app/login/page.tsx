import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-bussola-yellow">
            Bússola <span className="font-light text-black">Media</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Gestão de Conteúdo</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
