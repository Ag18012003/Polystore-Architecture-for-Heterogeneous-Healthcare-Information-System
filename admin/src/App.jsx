import React from "react";
import { Routes, Route } from "react-router-dom";

// Import pages
import Home from "./pages/Home/Home";
import Add from "./pages/Add/Add";
import List from "./pages/List/List";
import Appointments from "./pages/Appointments/Appointments";
import SerDashboard from "./pages/SerDashboard/SerDashboard";
import AddSer from "./pages/AddSer/AddSer";
import ListService from "./pages/ListService/ListService";
import ServiceAppointments from "./pages/ServiceAppointments/ServiceAppointments";
import Hero from "./components/Hero/Hero";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route path="/h" element={<Home />} />
      <Route path="/add" element={<Add />} />
      <Route path="/list" element={<List />} />
      <Route path="/appointments" element={<Appointments />} />
      <Route path="/service-dashboard" element={<SerDashboard />} />
      <Route path="/add-service" element={<AddSer />} />
      <Route path="/list-service" element={<ListService />} />
      <Route path="/service-appointments" element={<ServiceAppointments />} />
    </Routes>
  );
};

export default App;
