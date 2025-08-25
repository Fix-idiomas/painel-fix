"use client";
import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AdminSelfEnroll() {
  const [msg, setMsg] = useState("");
  const supabase = createClientComponentClient();

  async function handleActivate() {
    setMsg("Conferindo usuário…");
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) { setMsg("Faça login primeiro."); return; }

    // 1) vira admin (sem RLS na app_admins é imediato)
    const { error: upErr } = await supabase
      .from("app_admins")
      .upsert({ user_id: user.id }, { onConflict: "user_id" });
    if (upErr) { setMsg("Erro ao ativar admin: " + upErr.message); return; }

    // 2) valida
    const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_app_admin");
    if (rpcErr) { setMsg("Ativado, mas falhou checagem: " + rpcErr.message); return; }
    if (!isAdmin) { setMsg("Algo deu errado: ainda não consta como admin."); return; }

    setMsg("🎉 Você agora é admin. Já pode gerar lançamentos.");
  }

  async function handlePreview() {
    setMsg("Simulando geração…");
    const monthFirst = new Date(); monthFirst.setDate(1);
    const p_month = monthFirst.toISOString().slice(0,10); // YYYY-MM-01

    const { data, error } = await supabase.rpc("payments_generate_month", {
      p_month,
      p_dry_run: true
    });
    if (error) setMsg("Erro: " + error.message);
    else setMsg(`Prévia: seriam criados ${data} lançamentos.`);
  }

  async function handleGenerate() {
    setMsg("Gerando lançamentos…");
    const monthFirst = new Date(); monthFirst.setDate(1);
    const p_month = monthFirst.toISOString().slice(0,10);

    const { data, error } = await supabase.rpc("payments_generate_month", {
      p_month,
      p_dry_run: false
    });
    if (error) setMsg("Erro: " + error.message);
    else setMsg(`✅ Criados ${data} lançamentos.`);
  }

  return (
    <div className="p-4 border rounded-xl grid gap-2">
      <button onClick={handleActivate} className="px-4 py-2 rounded-xl bg-black text-white">
        Ativar Admin (este usuário)
      </button>
      <div className="flex gap-2">
        <button onClick={handlePreview} className="px-4 py-2 rounded-xl border">Prévia do mês</button>
        <button onClick={handleGenerate} className="px-4 py-2 rounded-xl border">Gerar mês</button>
      </div>
      <p className="text-sm opacity-80">{msg}</p>
    </div>
  );
}
