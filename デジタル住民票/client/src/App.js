import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Government from "./Government";
import Mypage from "./Mypage";

import Suiissue from "./Suiissue";

function App() {
    return (
        <Router>
            <nav style={{ padding: "10px", borderBottom: "1px solid #ccc", marginBottom: "20px" }}>
                <Link to="/" style={{ marginRight: "20px" }}>住民票発行 (Government)</Link>
                <Link to="/mypage" style={{ marginRight: "20px" }}>マイページ (Mypage)</Link>
                <Link to="/sui-issue">Suiトークン発行</Link>
            </nav>
            <Routes>
                <Route path="/" element={<Government />} />
                <Route path="/government" element={<Government />} />
                <Route path="/mypage" element={<Mypage />} />
                <Route path="/sui-issue" element={<Suiissue />} />
            </Routes>
        </Router>
    );
}

export default App;