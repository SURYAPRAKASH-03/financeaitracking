import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "bootstrap/dist/css/bootstrap.min.css";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "./predict.css";

const COLORS = ["#67b99dff", "#814848ff", "rgba(73, 73, 133, 1)"];

// ✅ Axios instance (so you don’t repeat localhost everywhere)
const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

function Predict() {
  const [view, setView] = useState("day");
  const [date, setDate] = useState("");
  const [income, setIncome] = useState("");
  const [expense, setExpense] = useState("");
  const [records, setRecords] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const tableRef = useRef();

  // Fetch all records on mount
  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await api.get("/records");
      setRecords(res.data);
    } catch (err) {
      console.error("❌ Error fetching records:", err.message);
    }
  };

  // Default filter date for "day"
  useEffect(() => {
    if (view === "day" && !filterDate) {
      setFilterDate(new Date().toISOString().split("T")[0]);
    }
  }, [view, filterDate]);

  const sumValues = (str) =>
    str
      .split("+")
      .map((s) => Number(s.trim()) || 0)
      .reduce((a, b) => a + b, 0);

  const handleAdd = async () => {
    if (!income || !expense || !date) {
      alert("⚠️ Enter income, expense, and date!");
      return;
    }

    const totalIncome = sumValues(income);
    const totalExpense = sumValues(expense);

    try {
      const res = await api.post("/records", {
        date,
        income: totalIncome,
        expense: totalExpense,
      });

      setRecords((prev) => {
        const exists = prev.find((r) => r.date === date);
        if (exists) {
          return prev.map((r) => (r.date === date ? res.data : r));
        } else {
          return [...prev, res.data];
        }
      });

      setIncome("");
      setExpense("");
      setDate("");
    } catch (err) {
      console.error("❌ Error adding record:", err.message);
      alert("Error adding record");
    }
  };

  const handleChatSearch = async () => {
    if (!chatQuery || loadingChat) return;
    setLoadingChat(true);
    setChatReply("");

    try {
      const res = await api.post("/chatbot", { query: chatQuery });
      setChatReply(res.data.reply || "No reply received.");
    } catch (err) {
      console.error("❌ Chatbot error:", err);
      const reply =
        err?.response?.data?.reply ||
        err?.response?.data?.error ||
        (err.message.includes("Network")
          ? "Cannot reach server. Ensure the backend is running on http://localhost:5000."
          : "Unable to process your request.");
      setChatReply(reply);
    } finally {
      setLoadingChat(false);
    }
  };

  // --- Grouping logic ---
  const groupTotals = (period) => {
    let filtered = records;
    if (period === "day" && filterDate)
      filtered = records.filter((r) => r.date === filterDate);
    else if (period === "week" && filterDate) {
      const d = new Date(filterDate);
      const startOfWeek = new Date(d.setDate(d.getDate() - d.getDay()));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      filtered = records.filter((r) => {
        const rd = new Date(r.date);
        return rd >= startOfWeek && rd <= endOfWeek;
      });
    } else if (period === "month" && filterDate) {
      const [year, month] = filterDate.split("-");
      filtered = records.filter(
        (r) =>
          new Date(r.date).getFullYear() === Number(year) &&
          new Date(r.date).getMonth() + 1 === Number(month)
      );
    } else if (period === "year" && filterDate) {
      filtered = records.filter(
        (r) => new Date(r.date).getFullYear() === Number(filterDate)
      );
    }

    const groups = {};
    filtered.forEach((r) => {
      const d = new Date(r.date);
      let key = "";
      if (period === "day") key = r.date;
      else if (period === "week")
        key = `Week of ${new Date(
          d.setDate(d.getDate() - d.getDay())
        ).toISOString().split("T")[0]}`;
      else if (period === "month") key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      else if (period === "year") key = `${d.getFullYear()}`;
      else if (period === "all") key = "All Records";
      if (!groups[key]) groups[key] = { income: 0, expense: 0 };
      groups[key].income += r.income;
      groups[key].expense += r.expense;
    });
    return groups;
  };

  const chartData = () => {
    if (!filterDate) return [];
    let incomeSum = 0;
    let expenseSum = 0;

    if (view === "day") {
      const record = records.find((r) => r.date === filterDate);
      if (record) {
        incomeSum = record.income;
        expenseSum = record.expense;
      }
    } else if (view === "week") {
      const d = new Date(filterDate);
      const startOfWeek = new Date(d.setDate(d.getDate() - d.getDay()));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      records.forEach((r) => {
        const rd = new Date(r.date);
        if (rd >= startOfWeek && rd <= endOfWeek) {
          incomeSum += r.income;
          expenseSum += r.expense;
        }
      });
    } else if (view === "month") {
      const [year, month] = filterDate.split("-");
      records.forEach((r) => {
        const rd = new Date(r.date);
        if (rd.getFullYear() === Number(year) && rd.getMonth() + 1 === Number(month)) {
          incomeSum += r.income;
          expenseSum += r.expense;
        }
      });
    } else if (view === "year") {
      const year = Number(filterDate);
      records.forEach((r) => {
        const rd = new Date(r.date);
        if (rd.getFullYear() === year) {
          incomeSum += r.income;
          expenseSum += r.expense;
        }
      });
    }

    const savings = incomeSum - expenseSum;
    return [
      { name: "Income", value: incomeSum },
      { name: "Expense", value: expenseSum },
      { name: "Savings", value: savings },
    ];
  };

  const totals = groupTotals(view);
  const uniqueYears = [...new Set(records.map((r) => new Date(r.date).getFullYear()))].sort(
    (a, b) => b - a
  );

  // --- PDF & Share ---
  const handleDownloadPDF = async () => {
    try {
      const element = tableRef.current;
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("finance-report.pdf");
    } catch (err) {
      console.error("❌ PDF error:", err);
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      const element = tableRef.current;
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], "finance-report.pdf", { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: "Finance Report",
          text: "Here’s my finance report 📊",
        });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(pdfBlob);
        link.download = "finance-report.pdf";
        link.click();
        alert("Your browser does not support WhatsApp PDF share. PDF downloaded instead.");
      }
    } catch (err) {
      console.error("❌ Share error:", err);
      alert("Error sharing PDF. Try downloading instead.");
    }
  };

  return (
    <div className="container text-center py-4">
      
      <h2 className="title ">Personal Finance Dashboard</h2>
<br></br>
      {/* Add Record */}
      <div className="d-flex justify-content-center mb-3 gap-2 flex-wrap">
        <div className="d-flex">
        <label>Date&emsp;&emsp;</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="formcontrol" />
        </div>

         <div className="d-flex">
        <label>Income&emsp;</label>
        <input placeholder="Income (100+200)" value={income} onChange={(e) => setIncome(e.target.value)} className="formcontrol" />
         </div>
          <div className="d-flex">
        <label>Expense&emsp;</label>
        <input placeholder="Expense (50+30)" value={expense} onChange={(e) => setExpense(e.target.value)} className="formcontrol" />
        </div>
      </div>
      <br></br>
        <button className="btn" onClick={handleAdd}>Add Record</button>
      <br></br>
      <br></br>
      {/* Filter */}
      <div className="d-flex justify-content-center align-items-center gap-4 flex-wrap my-3  ">
        <select value={view} onChange={(e) => setView(e.target.value)} className="formcontrol p-1 rounded-2">
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
          <option value="all">Overall</option>
          <option value="records">All Records</option>
        </select>

        {(view === "day" || view === "week") && (
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="formcontrol" />
        )}

        {view === "month" && (
          <input type="month" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="formcontrol" />
        )}

        {view === "year" && (
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="formcontrol">
            <option value="">-- Select Year --</option>
            {uniqueYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>
<br></br>
      {/* Records Table */}
      <p className="title">Record</p>
      <br></br>
      <div ref={tableRef}>
        <table className="table table-bordered w-75 mx-auto mt-3">
          <thead>
            <tr>
              <th>Date</th>
              <th>Income</th>
              <th>Expense</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {(view === "records"
              ? records
              : Object.entries(totals).map(([key, val]) => ({ date: key, ...val })))
              .map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.income}</td>
                  <td>{r.expense}</td>
                  <td>{(r.income - r.expense).toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
<br></br>
      {/* Buttons */}
      <div className="d-flex justify-content-center gap-4 my-3">
        <button className="btn" onClick={handleDownloadPDF}>Download PDF</button>
        <button className="btn" onClick={handleShareWhatsApp}>Share via WhatsApp</button>
      </div>
<br></br>
      {/* PieChart */}
      {filterDate && chartData().length > 0 && (
        <div style={{ width: "100%", height: "400px" }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={chartData()} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={120} label>
                {chartData().map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chatbot */}
      <div style={{ position: "fixed", bottom: "20px", right: "20px" }}>
        {chatOpen ? (
          <div className="card p-2 shadow rounded-3" style={{ width: "320px", background: "#f9fafb" }}>
            <div className="d-flex justify-content-between align-items-center mb-2 border-bottom pb-1">
              <strong className="text-primary">CHAT BOT</strong>
              <button onClick={() => setChatOpen(false)} className="closebutton">X</button>
            </div>
            <input
              type="text"
              placeholder='Try: "2025-09-17", "2025-09", "2025", "week 2025-09-17"'
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              className="form-control mb-2 rounded-2"
            />
            <button
              className="btn btn-success w-100 mb-2 rounded-2"
              onClick={handleChatSearch}
              disabled={loadingChat}
            >
              {loadingChat ? "Predicting..." : "Predict"}
            </button>
            {chatReply && (
              <div className="alert alert-info p-2 text-start rounded-2" style={{ maxHeight: "150px", overflowY: "auto", fontSize: "14px" }}>
                {chatReply}
              </div>
            )}
          </div>
        ) : (
          
          <button className="chatbutton rounded-circle p-2 shadow animate-bounce" onClick={() => setChatOpen(true)}>💬</button>
        )}
      </div>
    </div>
  );
}

export default Predict;