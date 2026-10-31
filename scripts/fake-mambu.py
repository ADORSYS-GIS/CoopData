#!/usr/bin/env python3
"""Local stand-in for the read-only part of the Mambu API v2 that CoopData's sync uses.

Synthetic data only, no personal data. Use it to test the Mambu Sync page without
Mambu credentials:  python3 scripts/fake-mambu.py [port]   (default 8099)
Point the backend at it:  MAMBU_BASE_URL=http://127.0.0.1:8099 MAMBU_API_KEY=local-test
"""
import json
import random
import sys
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
TODAY = date.today()

BRANCHES = [
    {"id": "ES0001", "name": "National Federation (not a SACCO)", "state": "ACTIVE", "region": None, "members": 0},
    {"id": "ES0002", "name": "Sambulelo SACCO", "state": "ACTIVE", "region": "Hhohho", "members": 25},
    {"id": "ES0006", "name": "Asikhutulisane SACCO", "state": "ACTIVE", "region": "Manzini", "members": 40},
    {"id": "ES0010", "name": "Zamimpilo SACCO", "state": "ACTIVE", "region": None, "members": 15},
]
for b in BRANCHES:
    b["encodedKey"] = "bk-" + b["id"].lower()

DEPOSIT_PRODUCTS = [
    {"id": "MDS", "encodedKey": "dp-shares", "name": "Mandatory Shares", "type": "CURRENT_ACCOUNT"},
    {"id": "SSV", "encodedKey": "dp-school", "name": "School Savings", "type": "REGULAR_SAVINGS"},
    {"id": "ORD", "encodedKey": "dp-ordinary", "name": "Ordinary Savings", "type": "REGULAR_SAVINGS"},
    {"id": "FD12", "encodedKey": "dp-fd12", "name": "Fixed Deposit", "type": "FIXED_DEPOSIT",
     "maturitySettings": {"maturityPeriod": {"maxValue": 12}, "maturityPeriodUnit": "MONTHS"}},
    {"id": "UMT36", "encodedKey": "dp-umt36", "name": "Umtfunti Account (36)", "type": "SAVINGS_PLAN",
     "maturitySettings": {"maturityPeriod": {"maxValue": 36}, "maturityPeriodUnit": "MONTHS"}},
    {"id": "PAY", "encodedKey": "dp-payout", "name": "Year End Payout Account", "type": "REGULAR_SAVINGS"},
]
LOAN_PRODUCTS = [
    {"id": "QL", "encodedKey": "lp-quick", "name": "Quick Loan", "type": "DYNAMIC_TERM_LOAN"},
    {"id": "LT", "encodedKey": "lp-long", "name": "Long Term Loan", "type": "DYNAMIC_TERM_LOAN"},
    {"id": "SCH", "encodedKey": "lp-school", "name": "School Fees Loan", "type": "FIXED_TERM_LOAN"},
]

GL = [
    ("M1101", "Cash till", "ASSET"), ("M1110", "Bank current", "ASSET"), ("M1201", "Loan portfolio", "ASSET"),
    ("M1250", "Loan loss provision", "ASSET"), ("M2101", "Member savings", "LIABILITY"),
    ("M2301", "Payables", "LIABILITY"), ("M3101", "Member shares", "EQUITY"), ("M3201", "Reserves", "EQUITY"),
    ("M4101", "Loan interest income", "INCOME"), ("M4102", "Fees income", "INCOME"),
    ("M5201", "Staff costs", "EXPENSE"), ("M5202", "Administrative expenses", "EXPENSE"),
]


def iso(d):
    return d.isoformat() + "T00:00:00+02:00"


def build_branch_data(b):
    rng = random.Random(b["id"])
    clients, deposits, loans = [], [], []
    for i in range(1, b["members"] + 1):
        ckey = f"c-{b['id']}-{i}"
        cid = f"{b['id'][-2:]}{i:04d}"
        roll = rng.random()
        state, closed, mcat = "ACTIVE", None, "Member"
        if roll < 0.06:
            state = "BLACKLISTED"
        elif roll < 0.12:
            state, closed = "EXITED", iso(date(TODAY.year, 2, 10))
        elif roll < 0.15:
            state, closed = "EXITED", iso(date(TODAY.year - 2, 5, 3))
        elif roll < 0.18:
            mcat = "Resigned"
        elif roll < 0.21:
            mcat = "Board"
        adl = {"mcat": mcat, "nid": "SYNTHETIC-NOT-A-REAL-ID"}
        if rng.random() < 0.6:
            adl["RG"] = rng.choice(["HHOHHO", "MANZINI", "SHISELWENI", "LUBOMBO"])
        if rng.random() < 0.7:
            adl["dateJoined"] = str(date(2018 + rng.randint(0, 6), rng.randint(1, 12), rng.randint(1, 28)))
        clients.append({
            "encodedKey": ckey, "id": cid, "state": state, "firstName": "Synthetic", "lastName": f"Member{i}",
            "activationDate": iso(date(2018 + rng.randint(0, 6), rng.randint(1, 12), rng.randint(1, 28))),
            "closedDate": closed, "birthDate": str(date(1950 + rng.randint(0, 50), rng.randint(1, 12), rng.randint(1, 28))),
            "gender": rng.choice(["MALE", "FEMALE"]), "assignedBranchKey": b["encodedKey"], "_ADL": adl,
        })
        base_act = iso(date(2019, 1, 1))
        deposits.append({"encodedKey": f"d-{ckey}-sh", "name": "Mandatory Shares", "accountType": "CURRENT_ACCOUNT",
                         "accountState": "ACTIVE", "accountHolderKey": ckey, "activationDate": base_act,
                         "productTypeKey": "dp-shares", "balances": {"totalBalance": 500}})
        deposits.append({"encodedKey": f"d-{ckey}-sv", "name": "School Savings", "accountType": "REGULAR_SAVINGS",
                         "accountState": rng.choice(["ACTIVE", "ACTIVE", "DORMANT"]), "accountHolderKey": ckey,
                         "activationDate": base_act, "productTypeKey": "dp-school",
                         "balances": {"totalBalance": rng.randint(0, 9000)},
                         "_centreOfDeduction": {"monthlyContribution": rng.choice([0, 100, 250])}})
        deposits.append({"encodedKey": f"d-{ckey}-po", "name": "Year End Payout Account", "accountType": "REGULAR_SAVINGS",
                         "accountState": "ACTIVE", "accountHolderKey": ckey, "activationDate": base_act,
                         "productTypeKey": "dp-payout", "balances": {"totalBalance": 40}})
        if rng.random() < 0.25:
            plan = rng.choice([("dp-fd12", "FIXED_DEPOSIT", "Fixed Deposit", None), ("dp-umt36", "SAVINGS_PLAN", "Umtfunti Account (36)", 36)])
            start = date(TODAY.year - 1, rng.randint(1, 12), 15)
            dep = {"encodedKey": f"d-{ckey}-fd", "name": plan[2], "accountType": plan[1], "accountState": "ACTIVE",
                   "accountHolderKey": ckey, "activationDate": iso(start), "productTypeKey": plan[0],
                   "balances": {"totalBalance": rng.randint(5000, 60000)}}
            if plan[1] == "SAVINGS_PLAN":
                dep["maturityDate"] = iso(date(start.year + 3, start.month, 15))
            deposits.append(dep)
        for n in range(rng.choice([0, 1, 1, 2])):
            lkey = f"l-{ckey}-{n}"
            start = date(TODAY.year, 1, 5) - timedelta(days=rng.randint(0, 200))
            kind = rng.random()
            loan = {"encodedKey": lkey, "id": f"LN{cid}{n}", "loanName": rng.choice(["Quick Loan", "Long Term Loan", "School Fees Loan"]),
                    "accountState": "ACTIVE", "accountSubState": "", "accountHolderKey": ckey, "accountHolderType": "CLIENT",
                    "loanAmount": rng.randint(2000, 30000), "balances": {"principalBalance": rng.randint(500, 20000)},
                    "interestSettings": {"interestRate": 2.0, "interestChargeFrequency": "EVERY_MONTH"},
                    "disbursementDetails": {"disbursementDate": iso(start), "firstRepaymentDate": iso(start + timedelta(days=30))},
                    "scheduleSettings": {"repaymentInstallments": 12, "repaymentPeriodCount": 1, "repaymentPeriodUnit": "MONTHS"},
                    "productTypeKey": "lp-quick", "_LINFO": {"loanp": "SCHOOL FEES" if rng.random() < 0.3 else "PERSONAL LOAN"}}
            if kind < 0.2:
                loan.update({"accountState": "ACTIVE_IN_ARREARS", "daysInArrears": rng.choice([10, 45, 75, 120])})
            elif kind < 0.27:
                loan.update({"accountState": "CLOSED", "accountSubState": "RESCHEDULED", "closedDate": iso(TODAY - timedelta(days=5))})
            elif kind < 0.32:
                loan.update({"accountState": "CLOSED", "accountSubState": "WRITTEN_OFF", "closedDate": iso(TODAY - timedelta(days=3))})
                loan["balances"] = {"principalBalance": 0}
            loans.append(loan)
    return clients, deposits, loans


DATA = {b["id"]: build_branch_data(b) for b in BRANCHES}
BY_KEY = {b["encodedKey"]: b["id"] for b in BRANCHES}


def report(branch_id, start, end):
    seed = sum(ord(c) for c in branch_id)
    months = max(1, (end.year - start.year) * 12 + end.month - start.month + 1)
    inc_open = {"M4101": 40000 + seed, "M4102": 6000 + seed}
    exp_open = {"M5201": 30000 + seed, "M5202": 9000 + seed}
    inc_flow = {"M4101": 4000, "M4102": 600}
    exp_flow = {"M5201": 3000, "M5202": 900}
    liabilities = {"M2101": 120000 + seed * 3, "M2301": 8000}
    equity = {"M3101": 50000, "M3201": 15000}
    earnings = sum(inc_open.values()) - sum(exp_open.values()) + months * (sum(inc_flow.values()) - sum(exp_flow.values()))
    provision = -3000
    portfolio = 90000 + seed
    cash = 1500
    bank = sum(liabilities.values()) + sum(equity.values()) + earnings - cash - portfolio - provision
    closing = {"M1101": cash, "M1110": bank, "M1201": portfolio, "M1250": provision, **liabilities, **equity}
    items = []
    for code, name, kind in GL:
        a = {"openingBalance": 0, "debits": 0, "credits": 0, "closingBalance": 0}
        if kind in ("ASSET", "LIABILITY", "EQUITY"):
            a["closingBalance"] = closing[code]
        elif kind == "INCOME":
            a.update(openingBalance=inc_open[code], credits=months * inc_flow[code])
            a["closingBalance"] = a["openingBalance"] + a["credits"]
        else:
            a.update(openingBalance=exp_open[code], debits=months * exp_flow[code])
            a["closingBalance"] = a["openingBalance"] + a["debits"]
        items.append({"glAccount": {"glCode": code, "name": name, "type": kind, "usage": "DETAIL",
                                    "currency": {"currencyCode": "SZL"}}, "amounts": a})
    return items


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[fake-mambu] " + fmt % args + "\n")

    def send(self, body, status=200):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/vnd.mambu.v2+json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def page(self, rows, q):
        limit = int(q.get("limit", ["50"])[0])
        offset = int(q.get("offset", ["0"])[0])
        return rows[offset: offset + limit]

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        p = u.path.rstrip("/")
        branch = q.get("branchId", [None])[0]
        if p == "/branches":
            return self.send(self.page([{"encodedKey": b["encodedKey"], "id": b["id"], "name": b["name"], "state": b["state"],
                                         "addresses": [{"region": b["region"]}] if b["region"] else []} for b in BRANCHES], q))
        if p in ("/clients", "/deposits", "/loans"):
            idx = {"/clients": 0, "/deposits": 1, "/loans": 2}[p]
            rows = DATA[branch][idx] if branch in DATA else [r for d in DATA.values() for r in d[idx]]
            return self.send(self.page(rows, q))
        if p == "/depositproducts":
            return self.send(self.page(DEPOSIT_PRODUCTS, q))
        if p == "/loanproducts":
            return self.send(self.page(LOAN_PRODUCTS, q))
        if p == "/glaccounts":
            kind = q.get("type", [None])[0]
            rows = [{"glCode": c, "name": n, "type": k, "usage": "DETAIL", "currency": {"currencyCode": "SZL"}}
                    for c, n, k in GL if kind in (None, k)]
            return self.send(self.page(rows, q))
        if p.startswith("/accounting/reports/"):
            _, branch_id, start, end = p.rsplit("/", 1)[1].split("_")
            items = report(branch_id, date.fromisoformat(start), date.fromisoformat(end))
            return self.send({"reportKey": p.rsplit("/", 1)[1], "status": "COMPLETE", "items": items})
        self.send({"errors": [{"errorCode": 404, "errorReason": "NOT_FOUND"}]}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(n) or b"{}")
        if urlparse(self.path).path.rstrip("/") == "/accounting/reports":
            key = "_".join(["rk", body["branchId"], body["startDate"], body["endDate"]])
            return self.send({"reportKey": key, "status": "QUEUED"}, 202)
        self.send({"errors": [{"errorCode": 404, "errorReason": "NOT_FOUND"}]}, 404)


if __name__ == "__main__":
    print(f"fake Mambu on http://127.0.0.1:{PORT}  (branches: {', '.join(b['id'] for b in BRANCHES)})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
