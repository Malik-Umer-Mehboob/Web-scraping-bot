

# 🌐 Web Scraping Project

This project is a **Next.js + Tailwind CSS + Playwright** based web scraping tool that allows users to extract website data through multiple interactive modes.  
It includes authentication, DOM scraping, filtering, element selection, and CSV export functionality.
.  

---

 🚀 Features  

  **Authentication** – Secure Sign Up, Sign In, and Logout functionality.  
- **DOM Scraping** – Enter a website URL, scrape the full DOM, and display all elements.  
- **Selector Helper Mode** – Apply filters on scraped data for refined extraction.  
- **Mouse Mode** – Open a website interactively and manually select elements by clicking or hovering.  
- **CSV Export** – Download scraped or filtered data as a CSV file.  
- **Responsive UI** – Modern and clean design using Next.js and Tailwind CSS.  

---

🛠️ Tech Stack  

- **Frontend:** Next.js, Tailwind CSS  
- **Backend:** Next.js API routes  
- **Web Scraping:** Playwright  
- **Authentication:** NextAuth.js  
- **Database:** MongoDB (for storing user credentials)  

---

## ⚙️ Installation & Setup  

1. Clone the Repository 
   ```bash
   git clone https://github.com/your-username/web-scraping-project.git
   cd web-scraping-project
````

 Install Dependencies

   ```bash
   npm install
   ```


 Run the Development Server

   ```bash
   npm run dev
   ```

   Now open [http://localhost:3000](http://localhost:3000) 🚀

---

📖 Usage
🔑 Authentication

Sign Up to create an account.

Sign In to access the scraping tools.

Logout anytime from the Navbar.

🕸️ DOM Scraping

Enter a website URL.

Scraper fetches all DOM elements and displays them.

🎯 Selector Helper

Navigate to Selector Helper Mode.

Apply filters to extract specific elements from the scraped data.

🖱️ Mouse Mode

Enter a website URL.

Website opens in interactive mode.

Hover or click elements → they get highlighted & selected.

Selected elements appear on the dashboard.

📑 Export Data

All scraped, filtered, or selected data can be exported as a CSV file.
