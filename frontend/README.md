# MuleNet Frontend (SafePay + Compliance Desk)

UI by **Nivethitha** (React 19, Vite, TypeScript, Tailwind). Backend wiring to real MuleNet output by the team.

## Run (two terminals)
Backend (needs `results/results.csv` and `artifacts/meta.json` from the repo root, i.e. this folder sits at `MuleNet/frontend`):
```
cd frontend\backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8000
```
Frontend:
```
cd frontend
npm install
npm run dev
```
Open the URL Vite prints. If `results.csv` lives elsewhere, set env `MULENET_REPO` to the repo root.

## What is real
- Every score, decision and reason comes from `results/results.csv` (MuleNet model output on the IBM AML HI-Small test stream). The backend **replays** it; it does not run the model live.
- Model metrics on the dashboard come from `artifacts/meta.json` (test PR-AUC 0.165, precision 0.182, recall 0.281).
- Accounts not in the file show "Not scored".

## What is not
- "Mock" data mode is random and labelled SIMULATED.
- The explainer chat is templates, not an LLM.
- SAR export is a draft, not filed. Audit log is in memory and resets on restart.
- Bank names, UPI app names and the checkout flow are illustrative.
- Dataset: IBM synthetic AML data (CDLA-Sharing-1.0).
