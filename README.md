# SubScript 

A student-friendly subscription and expense tracking application. Students manage subscriptions and spending, while parents monitor finances without micromanaging.

---

##  What is SubScript?

SubScript helps students track recurring payments (Netflix, Spotify, etc.), log daily expenses, and monitor free trials. Parents get a read-only dashboard to see spending patterns. Designed for students to stay on budget without constant parental control.

**Key Features:**
- Subscription management with renewal tracking
- Expense logging with categories
- Free trial monitoring with alerts
- Monthly budget limits per category
- Separate student & parent dashboards
- Safe daily spending calculator

---

##  Project Structure

```
SubScript/
├── frontend/
│   ├── index.html, login.html, onboarding.html
│   ├── dashboard.html, parent-dashboard.html
│   ├── subscriptions.html, expenses.html, trials.html, settings.html
│   └── static/
│       ├── app.js (UI logic)
│       ├── data.js (API calls & state)
│       └── styles.css
├── backend/
│   ├── db.php (MySQL connection)
│   ├── login.php, logout.php, register.php, updateUser.php
│   ├── addSubscription.php, deleteSubscription.php
│   ├── addExpense.php, deleteExpense.php
│   ├── resolveTrial.php
│   ├── helpers.php (utility functions)
│   └── database_setup.sql
└── README.md
```

---

##  Database Tables

| Table | Purpose |
|-------|---------|
| **users** | Student & parent accounts (linked via `linked_student_id`) |
| **subscriptions** | Recurring services with amount, billing cycle, renewal date |
| **expenses** | Individual spending entries with category & date |
| **trials** | Free trial subscriptions with expiration tracking |
| **payments** | Payment history for subscriptions |
| **budgets** | Monthly category spending limits |
| **categories** | Expense categories (Food, Transport, etc.) |

---

##  User Roles

### Student
- Add/remove subscriptions
- Log daily expenses
- Set category budgets
- View safe daily spending: `(Allowance - Subscriptions) / Days`
- Monitor upcoming trials
- Update profile & preferences

### Parent
- View student's dashboard (read-only)
- See all subscriptions & spending
- Monitor trial alerts
- View expense history
- Cannot edit student data

---

## Setup & Installation

### Prerequisites
- PHP 7.2+
- MySQL 5.7+
- Apache web server
- Modern browser

### Steps
1. **Database Setup**
   ```bash
   mysql -u root -p < backend/database_setup.sql
   ```

2. **Configure DB Connection** (`backend/db.php`)
   ```php
   $host = "localhost";
   $user = "root";
   $password = "";
   $db = "SubScript";
   ```

3. **Run Application**
   - Place in web server root (htdocs for Apache)
   - Access: `http://localhost/SubScript/frontend/index.html`

---

##  Security

- Password hashing with bcrypt
- Server-side sessions
- Prepared statements (SQL injection prevention)
- Role-based access control
- Input validation

---

##  How It Works

1. Student registers with parent details
2. Parent account auto-created and linked
3. Student sets monthly allowance & adds subscriptions
4. Student logs daily expenses
5. Parent logs in to view student's dashboard
6. Trial alerts prevent surprise charges

---

##  Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** PHP with RESTful API
- **Database:** MySQL
- **Auth:** Session-based

---

**Made to help students manage subscriptions responsibly. **

