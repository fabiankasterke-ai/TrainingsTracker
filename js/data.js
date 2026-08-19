// Gemeinsame Datenzugriffs-Hilfsfunktionen, die von mehreren Views genutzt werden
// (aktuell: Home-Dashboard und Plan-Übersicht).

// Setzt genau einen Plan als "aktiv" (für die Home-Startseite) – deaktiviert alle
// anderen Pläne des Nutzers. RLS sorgt dafür, dass nur die eigenen Pläne betroffen sind.
export async function setActivePlan(supabase, planId) {
  const { error: e1 } = await supabase.from("plans").update({ is_active: false }).neq("id", planId);
  if (e1) return { error: e1 };
  const { error: e2 } = await supabase.from("plans").update({ is_active: true }).eq("id", planId);
  return { error: e2 };
}
