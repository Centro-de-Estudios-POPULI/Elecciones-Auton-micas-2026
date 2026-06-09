"""
sync_github.py — Sube los dashboards electorales a GitHub Pages.

Copia los HTMLs relevantes desde la carpeta de trabajo al clon local del repo,
hace git add/commit/push automático.

Configurar REPO_DIR con la ruta del clon local del repositorio GitHub.

Uso:
    python sync_github.py
    python sync_github.py --dry-run     # solo muestra qué copiaría, sin ejecutar
    python sync_github.py --mensaje "Actualiza segunda vuelta Beni"
"""
import shutil
import subprocess
import argparse
import sys
from pathlib import Path
from datetime import datetime

# ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────
SRC   = Path(__file__).parent                   # carpeta de trabajo local
REPO  = Path(r"C:\Users\HP\OneDrive\Desktop\Electoral_2026_pages_clone")
# Clon local de https://github.com/Centro-de-Estudios-POPULI/Elecciones-Auton-micas-2026
# ─────────────────────────────────────────────────────────────────────────────

# Mapeo: (ruta relativa en SRC, ruta relativa en REPO)
COPIAS = [
    # Portal
    ("index.html",                                   "index.html"),
    # Gobernaciones (9)
    ("gobernaciones/dashboard/dashboard_la_paz.html",        "gobernaciones/dashboard/dashboard_la_paz.html"),
    ("gobernaciones/dashboard/dashboard_cochabamba.html",    "gobernaciones/dashboard/dashboard_cochabamba.html"),
    ("gobernaciones/dashboard/dashboard_santa_cruz.html",    "gobernaciones/dashboard/dashboard_santa_cruz.html"),
    ("gobernaciones/dashboard/dashboard_potosi.html",        "gobernaciones/dashboard/dashboard_potosi.html"),
    ("gobernaciones/dashboard/dashboard_beni.html",          "gobernaciones/dashboard/dashboard_beni.html"),
    ("gobernaciones/dashboard/dashboard_tarija.html",        "gobernaciones/dashboard/dashboard_tarija.html"),
    ("gobernaciones/dashboard/dashboard_chuquisaca.html",    "gobernaciones/dashboard/dashboard_chuquisaca.html"),
    ("gobernaciones/dashboard/dashboard_oruro.html",         "gobernaciones/dashboard/dashboard_oruro.html"),
    ("gobernaciones/dashboard/dashboard_pando.html",         "gobernaciones/dashboard/dashboard_pando.html"),
    # Segunda vuelta (5)
    ("segunda_vuelta/GOB_0902_Chuquisaca_2daVuelta.html",    "segunda_vuelta/GOB_0902_Chuquisaca_2daVuelta.html"),
    ("segunda_vuelta/GOB_0904_Oruro_2daVuelta.html",         "segunda_vuelta/GOB_0904_Oruro_2daVuelta.html"),
    ("segunda_vuelta/GOB_0906_Tarija_2daVuelta.html",        "segunda_vuelta/GOB_0906_Tarija_2daVuelta.html"),
    ("segunda_vuelta/GOB_0907_SantaCruz_2daVuelta.html",     "segunda_vuelta/GOB_0907_SantaCruz_2daVuelta.html"),
    ("segunda_vuelta/GOB_0908_Beni_2daVuelta.html",          "segunda_vuelta/GOB_0908_Beni_2daVuelta.html"),
    # Municipales (10)
    ("dashboard/municipales/dashboard_nacional.html",        "dashboard/municipales/dashboard_nacional.html"),
    ("dashboard/municipales/dashboard_la_paz.html",          "dashboard/municipales/dashboard_la_paz.html"),
    ("dashboard/municipales/dashboard_cochabamba.html",      "dashboard/municipales/dashboard_cochabamba.html"),
    ("dashboard/municipales/dashboard_santa_cruz.html",      "dashboard/municipales/dashboard_santa_cruz.html"),
    ("dashboard/municipales/dashboard_potosi.html",          "dashboard/municipales/dashboard_potosi.html"),
    ("dashboard/municipales/dashboard_beni.html",            "dashboard/municipales/dashboard_beni.html"),
    ("dashboard/municipales/dashboard_tarija.html",          "dashboard/municipales/dashboard_tarija.html"),
    ("dashboard/municipales/dashboard_chuquisaca.html",      "dashboard/municipales/dashboard_chuquisaca.html"),
    ("dashboard/municipales/dashboard_oruro.html",           "dashboard/municipales/dashboard_oruro.html"),
    ("dashboard/municipales/dashboard_pando.html",           "dashboard/municipales/dashboard_pando.html"),
]


def git(args, cwd, dry=False):
    cmd = ["git"] + args
    print("  git", " ".join(args))
    if dry:
        return 0
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.stdout.strip():
        print("   ", r.stdout.strip())
    if r.returncode != 0 and r.stderr.strip():
        print("  STDERR:", r.stderr.strip())
    return r.returncode


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Solo muestra, no ejecuta")
    ap.add_argument("--mensaje", default="", help="Mensaje de commit personalizado")
    args = ap.parse_args()
    dry = args.dry_run

    if not REPO.exists():
        print(f"ERROR: El directorio del repo no existe: {REPO}")
        print("Crea el clon local primero:")
        print("  git clone https://github.com/TU_USUARIO/TU_REPO.git", str(REPO))
        sys.exit(1)

    # ── Copiar archivos ──────────────────────────────────────────────────────
    ok = err = 0
    for src_rel, dst_rel in COPIAS:
        src = SRC / src_rel
        dst = REPO / dst_rel
        if not src.exists():
            print(f"  FALTA {src_rel}")
            err += 1
            continue
        if not dry:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        kb = src.stat().st_size // 1024
        print(f"  {'[DRY]' if dry else 'OK  '} {src_rel}  ({kb} KB)")
        ok += 1

    print(f"\nCopiados: {ok}  |  Faltantes: {err}")
    if err:
        print("Revisa los archivos faltantes antes de continuar.")
        if not dry:
            sys.exit(1)

    # ── Git add / commit / push ─────────────────────────────────────────────
    print("\n--- Git ---")
    git(["config", "user.email", "carlosarandah1896@gmail.com"], REPO, dry)
    git(["config", "user.name",  "Carlos Aranda"], REPO, dry)
    git(["add", "-A"], REPO, dry)

    status = subprocess.run(["git", "status", "--short"], cwd=REPO,
                            capture_output=True, text=True)
    if not dry and not status.stdout.strip():
        print("  Sin cambios — nada que commitear.")
        return

    fecha   = datetime.now().strftime("%Y-%m-%d %H:%M")
    mensaje = args.mensaje or f"Actualiza dashboards electorales — {fecha}"
    git(["commit", "-m", mensaje], REPO, dry)
    git(["push"], REPO, dry)

    if not dry:
        print("\nDone. GitHub Pages actualizado.")


if __name__ == "__main__":
    main()
