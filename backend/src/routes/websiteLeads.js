const express = require("express");
const auth = require("../middleware/auth");
const { authorize } = require("../middleware/auth");
const Notification = require("../models/Notification");
const WebsiteLead = require("../models/WebsiteLead");

const router = express.Router();
const allowedFormTypes = ["contact", "enquiry", "admission"];

function cleanText(value) {
  return String(value || "")
    .replace(/[\r\n\0]+/g, " ")
    .trim();
}

function cleanFormType(value) {
  const formType = cleanText(value).toLowerCase();
  return allowedFormTypes.includes(formType) ? formType : "contact";
}

function makeReferenceNo(formType) {
  const prefix = {
    admission: "ADM",
    enquiry: "ENQ",
    contact: "MSG",
  }[formType] || "WEB";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${Date.now()}-${suffix}`;
}

function normalizeLead(body) {
  const formType = cleanFormType(body.formType);
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

  return {
    source: cleanText(body.source) || "savvy-mother-toddler",
    formType,
    referenceNo: cleanText(body.referenceNo) || makeReferenceNo(formType),
    childName: cleanText(body.childName || payload.childName),
    parentName: cleanText(body.parentName || payload.parentName || payload.parentGuardianName),
    className: cleanText(body.className || payload.className || payload.admittedClass || payload.classAppliedFor),
    phone: cleanText(body.phone || payload.phone || payload.fatherContact || payload.motherContact || payload.guardianContact),
    email: cleanText(body.email || payload.email || payload.motherEmail || payload.fatherEmail),
    subject: cleanText(body.subject) || `${formType} form from website`,
    message: cleanText(body.message),
    priority: cleanText(body.priority).toLowerCase() || (formType === "admission" ? "high" : "medium"),
    payload,
  };
}

async function createLeadNotification(lead) {
  try {
    await Notification.create({
      title: "New website lead",
      message: `${lead.formType} form received from ${lead.parentName || lead.childName || "website visitor"}.`,
      channels: ["app"],
      targetRoles: ["superadmin", "admin", "staff"],
      status: "queued",
      metadata: {
        type: "website-lead",
        leadId: lead._id,
        referenceNo: lead.referenceNo,
        formType: lead.formType,
      },
    });
  } catch (error) {
    console.error("Failed to create website lead notification", error);
  }
}

// Public intake endpoint used by the Savvy Mother Toddler website.
router.post("/", async (req, res) => {
  try {
    const leadData = normalizeLead(req.body);

    if (!leadData.phone && !leadData.email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    if (!leadData.parentName && !leadData.childName && !leadData.message) {
      return res.status(400).json({ error: "Lead details are required" });
    }

    const lead = await WebsiteLead.create(leadData);
    await createLeadNotification(lead);

    res.status(201).json({
      success: true,
      id: lead._id,
      referenceNo: lead.referenceNo,
    });
  } catch (error) {
    console.error("Error creating website lead", error);
    res.status(500).json({ error: "Failed to save website lead" });
  }
});

router.get("/", auth, authorize("website_leads.view"), async (req, res) => {
  try {
    const query = {};
    const formType = cleanFormType(req.query.formType);
    const status = cleanText(req.query.status).toLowerCase();
    const search = cleanText(req.query.search);

    if (req.query.formType && allowedFormTypes.includes(formType)) query.formType = formType;
    if (status && status !== "all") query.status = status;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { referenceNo: searchRegex },
        { childName: searchRegex },
        { parentName: searchRegex },
        { className: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { subject: searchRegex },
      ];
    }

    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const leads = await WebsiteLead.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(leads);
  } catch (error) {
    console.error("Error fetching website leads", error);
    res.status(500).json({ error: "Failed to fetch website leads" });
  }
});

router.get("/:id", auth, authorize("website_leads.view"), async (req, res) => {
  try {
    const lead = await WebsiteLead.findById(req.params.id).lean();
    if (!lead) return res.status(404).json({ error: "Website lead not found" });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch website lead" });
  }
});

router.patch("/:id", auth, authorize("website_leads.edit", "website_leads.manage"), async (req, res) => {
  try {
    const updates = {};
    ["status", "priority"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = cleanText(req.body[field]).toLowerCase();
      }
    });
    if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
      updates.notes = cleanText(req.body.notes);
    }
    updates.reviewedBy = req.user._id;

    const lead = await WebsiteLead.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!lead) return res.status(404).json({ error: "Website lead not found" });
    res.json(lead);
  } catch (error) {
    console.error("Error updating website lead", error);
    res.status(500).json({ error: "Failed to update website lead" });
  }
});

router.delete("/:id", auth, authorize("website_leads.delete", "website_leads.manage"), async (req, res) => {
  try {
    const lead = await WebsiteLead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: "Website lead not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete website lead" });
  }
});

module.exports = router;
