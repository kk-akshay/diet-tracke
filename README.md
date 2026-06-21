# MacroSync Engine 🚀

A streamlined, type-safe Next.js application built to track and optimize daily nutrition across contrasting target profiles simultaneously. Designed specifically to manage an underweight weight-gain profile (3000 kcal target) alongside shared roommate weight-loss profiles (2800 kcal target) seamlessly from a single terminal interface.

---

## ⚡ Core Features

* **Dual-Profile Orchestration:** Switch cleanly between the **Gain track (3000 kcal)** and **Loss track (2800 kcal)** with active runtime adjustments.
* **Dynamic Calorie Gauge:** Displays current totals against target ceilings, automatically calculating precise remaining balances or overshoot margins.
* **4-Stage Day Logs:** Structures data into specific intake windows: *Breakfast*, *Lunch*, *Evening Snack*, and *Dinner*.
* **Adaptive Theme Engine:** Features a full Light/Dark mode switcher to resolve ambient visibility issues and prevent text clipping or contrast failures.
* **Local Persistence Layer:** Zero database overhead. All historical logs, macro counts, and tracking dates persist securely inside the browser's `localStorage`.
* **Custom Food Factory:** Define unique custom ingredients with specific macro profiles (Protein, Carbs, Fat, Fiber) to supplement the predefined catalog instantly.
* **Habit Tracker & Weight Logger:** Checkboxes for crucial daily benchmarks (*Daily Walk*, *Exercise*, *Sugar Cut*) combined with regular weight monitoring inputs.
* **Master Excel Export Engine:** Compiles complete multi-profile timelines directly into Excel-ready, cleanly separated `.csv` datasets with one click.

---

## 🛠️ Built With

* **Framework:** [Next.js 14+](https://nextjs.org/) (App Router architecture)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Language:** [TypeScript](https://www.typescriptlang.org/) (Enforces rigid type definitions for food logs and data structure integrity)
* **Storage Backend:** Client-Side Web Storage API (`localStorage`)

---

## 📦 Project Structure

```text
├── src/
│   ├── app/
│   │   ├── layout.tsx     # Application global wrappers and viewport settings
│   │   ├── page.tsx       # Core dashboard, state logic, and UI interface
│   │   └── globals.css    # Tailwind base directives
│   ├── data/
│   │   └── fixedFoods.ts  # Predefined food metrics baseline array
│   └── types/
│       └── diet.ts        # Typed object interfaces for logs, meals, and macros