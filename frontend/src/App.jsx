import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import Predict from "./Predict";
import "./index.css";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";

function PinPage() {
  const [pin, setPin] = useState("");
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (pin === "102503") {
      // ✅ replace: true prevents going back to this page
      navigate("/Predict", { replace: true });
    } else {
      alert("Invalid PIN ❌");
    }
  };

  return (
    <div
      className="d-grid justify-content-center align-items-center text-center vw-100"
      style={{
        display: "grid",
        placeItems: "center",
        fontFamily: "serif",
        textAlign: "center",
        fontSize: "20px",
        transform: "translateY(35vh)",
      }}
    >
      <h3
        className="d-grid justify-content-center align-items-center"
        style={{ width: "80vw", fontSize: "30px" }}
      >
        ENTER YOUR PIN
      </h3>
      <br />
      <input
        type="password"
        placeholder="PLEASE ENTER YOUR PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />
      <br />
      <button onClick={handleSubmit} style={{ borderRadius: "10px" }}>
        ENTER INTO
      </button>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PinPage />} />
        <Route path="/Predict" element={<Predict />} />
      </Routes>
    </Router>

  );
}

export default App;
