import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  appointmentPageStyles,
  cardStyles,
  badgeStyles,
  iconSize,
} from "../../assets/dummyStyles";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const API = axios.create({ baseURL: API_BASE });

/* -------------------- Helpers -------------------- */
function pad(n) {
  return String(n ?? 0).padStart(2, "0");
}

function parseDateTime(dateStr, timeStr) {
  const fast = new Date(`${dateStr} ${timeStr}`);
  if (!isNaN(fast)) return fast;

  const parts = (dateStr || "").split(" ");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const months = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = months[m];
    let [t, ampm] = (timeStr || "").split(" ");
    let [hh, mm] = (t || "0:00").split(":");
    hh = Number(hh || 0);
    mm = Number(mm || 0);
    if (ampm === "PM" && hh !== 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    return new Date(Number(y), month, Number(d), hh, mm);
  }

  const iso = new Date(dateStr);
  if (!isNaN(iso)) return iso;
  return new Date();
}

function computeStatus(item) {
  const now = new Date();
  if (!item) return "Pending";
  if (item.status === "Canceled") return "Canceled";
  if (item.status === "Rescheduled") {
    if (item.rescheduledTo && item.rescheduledTo.date && item.rescheduledTo.time) {
      const dt = parseDateTime(item.rescheduledTo.date, item.rescheduledTo.time);
      if (now >= dt) return "Completed";
    }
    return "Rescheduled";
  }
  if (item.status === "Completed") return "Completed";
  if (item.status === "Confirmed") {
    const dt = parseDateTime(item.date, item.time);
    if (now >= dt) return "Completed";
    return "Confirmed";
  }
  if (item.status === "Pending") {
    const dt = parseDateTime(item.date, item.time);
    if (now >= dt) return "Completed";
    return "Pending";
  }
  const dt = parseDateTime(item.date, item.time);
  if (now >= dt) return "Completed";
  return "Pending";
}

/* -------------------- Badge Components -------------------- */
const PaymentBadge = ({ payment }) => {
  const method = typeof payment === "string" ? payment : payment?.method || "Cash";
  return (
    <span className={badgeStyles.paymentBadge?.cash || "px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700"}>
      {method}
    </span>
  );
};

const StatusBadge = ({ itemStatus }) => {
  if (itemStatus === "Completed")
    return (
      <span className={badgeStyles.statusBadge?.completed || "px-2 py-1 text-xs rounded bg-green-100 text-green-700"}>
        <CheckCircle className={iconSize.small} /> Completed
      </span>
    );
  if (itemStatus === "Confirmed")
    return (
      <span className={badgeStyles.statusBadge?.confirmed || "px-2 py-1 text-xs rounded bg-blue-100 text-blue-700"}>
        <CheckCircle className={iconSize.small} /> Confirmed
      </span>
    );
  if (itemStatus === "Pending")
    return (
      <span className={badgeStyles.statusBadge?.pending || "px-2 py-1 text-xs rounded bg-orange-100 text-orange-700"}>
        Pending
      </span>
    );
  if (itemStatus === "Canceled")
    return (
      <span className={badgeStyles.statusBadge?.canceled || "px-2 py-1 text-xs rounded bg-red-100 text-red-700"}>
        <XCircle className={iconSize.small} /> Canceled
      </span>
    );
  return (
    <span className={badgeStyles.statusBadge?.default || "px-2 py-1 text-xs rounded bg-gray-100 text-gray-700"}>
      <CalendarDays className={iconSize.small} /> {itemStatus}
    </span>
  );
};

/* -------------------- Component -------------------- */
export default function AppointmentPage() {
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  const [doctorAppts, setDoctorAppts] = useState([]);
  const [serviceAppts, setServiceAppts] = useState([]);
  const [error, setError] = useState(null);

  const loadDoctorAppointments = useCallback(async () => {
    setLoadingDoctors(true);
    setError(null);
    try {
      const resp = await API.get("/api/appointments");
      const fetched = resp?.data?.appointments ?? resp?.data?.data ?? resp?.data ?? [];
      const arr = Array.isArray(fetched) ? fetched : [];
      setDoctorAppts(arr);
    } catch (err) {
      console.error("Error loading doctor appointments:", err?.response?.data || err.message);
      setError("Failed to load doctor appointments.");
      setDoctorAppts([]);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  const loadServiceAppointments = useCallback(async () => {
    setLoadingServices(true);
    try {
      const resp = await API.get("/api/service-appointments");
      const fetched = resp?.data?.appointments ?? resp?.data?.data ?? resp?.data ?? [];
      const arr = Array.isArray(fetched) ? fetched : [];
      setServiceAppts(arr);
    } catch (err) {
      console.error("Error loading service appointments:", err?.response?.data || err.message);
      setServiceAppts([]);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    loadDoctorAppointments();
    loadServiceAppointments();
  }, [loadDoctorAppointments, loadServiceAppointments]);

  function normalizeRescheduled(rt) {
    if (!rt) return null;
    if (rt.date && rt.time) return { date: rt.date, time: rt.time };
    if (rt.date && (rt.hour !== undefined || rt.minute !== undefined || rt.ampm)) {
      const hour = rt.hour ?? 0;
      const minute = rt.minute ?? 0;
      const ampm = rt.ampm ?? "";
      return { date: rt.date, time: `${hour}:${pad(minute)} ${ampm}` };
    }
    return { date: rt.date || "", time: rt.time || "" };
  }

  const appointmentData = useMemo(() => {
    return doctorAppts
      .map((a) => {
        const id = a._id || a.id || "";
        const image = a.doctorImage || "";
        const doctorName = a.doctorName || "Doctor";
        const patientName = a.patientName || "Patient";
        const specialization = a.specialization || "";
        const date = a.date || "";
        let time = a.time || "";
        const payment = (a.payment && a.payment.method) || "Cash";
        const status = a.status || "Pending";
        const rescheduledTo = normalizeRescheduled(a.rescheduledTo || null);
        return { id, image, doctor: doctorName, patientName, specialization, date, time, payment, status, rescheduledTo };
      })
      .map((x) => ({ ...x, status: computeStatus(x) }));
  }, [doctorAppts]);

  const serviceData = useMemo(() => {
    return serviceAppts
      .map((s) => {
        const id = s._id || s.id || "";
        const image = s.serviceImage?.url || s.serviceImage || "";
        const name = s.serviceName || "Service";
        const patientName = s.patientName || "Patient";
        const price = s.fees ?? s.amount ?? 0;
        const date = s.date || "";
        let time = s.time || "";
        if (!time && s.hour !== undefined && s.ampm) {
          time = `${s.hour}:${pad(s.minute || 0)} ${s.ampm}`;
        }
        const payment = (s.payment && s.payment.method) || "Cash";
        const status = s.status || "Pending";
        const rescheduledTo = normalizeRescheduled(s.rescheduledTo || null);
        return { id, image, name, patientName, price, date, time, payment, status, rescheduledTo };
      })
      .map((x) => ({ ...x, status: computeStatus(x) }));
  }, [serviceAppts]);

  return (
    <div className={appointmentPageStyles.pageContainer}>
      <Toaster position="top-right" />
      <div className={appointmentPageStyles.maxWidthContainer}>
        {/* ------------ DOCTOR APPOINTMENTS ------------ */}
        <h1 className={appointmentPageStyles.doctorTitle}>Doctor Appointments</h1>

        {loadingDoctors && (
          <div className={appointmentPageStyles.loadingText}>Loading doctors...</div>
        )}

        {!loadingDoctors && appointmentData.length === 0 && (
          <div className={appointmentPageStyles.emptyStateText}>No doctor appointments found.</div>
        )}

        <div className={appointmentPageStyles.doctorGrid}>
          {appointmentData.map((item) => (
            <div key={item.id} className={cardStyles.doctorCard}>
              <div className={cardStyles.doctorImageContainer}>
                <img
                  src={item.image || "/placeholder-doctor.png"}
                  alt={item.doctor}
                  className={cardStyles.image}
                  loading="lazy"
                />
              </div>
              <h2 className={cardStyles.doctorName}>{item.doctor}</h2>
              <div className={cardStyles.specialization}>{item.specialization}</div>
              <p className={cardStyles.dateContainer}>
                <CalendarDays className={iconSize.medium} /> {item.date}
              </p>
              <p className={cardStyles.timeContainer}>
                <Clock className={iconSize.medium} /> {item.time}
              </p>
              <div className={cardStyles.badgesContainer}>
                <PaymentBadge payment={item.payment} />
                <StatusBadge itemStatus={item.status} />
              </div>
              {item.status === "Rescheduled" && item.rescheduledTo && (
                <div className={cardStyles.rescheduledText}>
                  Rescheduled to{" "}
                  <span className={cardStyles.rescheduledSpan}>
                    {item.rescheduledTo.date} : {item.rescheduledTo.time}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ------------ SERVICE BOOKINGS ------------ */}
        <h2 className={appointmentPageStyles.serviceTitle}>Booked Services</h2>

        {loadingServices && (
          <div className={appointmentPageStyles.serviceLoadingText}>Loading service bookings...</div>
        )}

        {!loadingServices && serviceData.length === 0 && (
          <div className={appointmentPageStyles.serviceEmptyStateText}>No service bookings found.</div>
        )}

        <div className={appointmentPageStyles.serviceGrid}>
          {serviceData.map((srv) => (
            <div key={srv.id} className={cardStyles.serviceCard}>
              <div className={cardStyles.serviceImageContainer}>
                <img
                  src={srv.image || "/placeholder-service.png"}
                  alt={srv.name}
                  className={cardStyles.image}
                  loading="lazy"
                />
              </div>
              <h3 className={cardStyles.serviceName}>{srv.name}</h3>
              <p className={cardStyles.price}>₹{srv.price}</p>
              <p className={cardStyles.serviceDateContainer}>
                <CalendarDays className={iconSize.medium} /> {srv.date}
              </p>
              <p className={cardStyles.serviceTimeContainer}>
                <Clock className={iconSize.medium} /> {srv.time}
              </p>
              <div className={cardStyles.badgesContainer}>
                <PaymentBadge payment={srv.payment} />
                <StatusBadge itemStatus={srv.status} />
              </div>
              {srv.status === "Rescheduled" && srv.rescheduledTo && (
                <div className={cardStyles.serviceRescheduledText}>
                  Rescheduled to{" "}
                  <span className={cardStyles.rescheduledSpan}>
                    {srv.rescheduledTo.date} : {srv.rescheduledTo.time}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
