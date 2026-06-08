"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { checkGroomingAvailability, createBooking, getAvailableRooms } from "@/app/actions/bookings";
import { getCustomerPets, searchCustomers } from "@/app/actions/lookups";
import { useToast } from "@/components/ui/toast-provider";
import { validateHotelStayDates, validatePaymentDraft } from "@/lib/booking-draft";
import {
  normalizePhone,
  parseImportedBookingChat,
  type ImportedBookingChatData
} from "@/lib/booking-chat-import";
import type { AvailableRoomOption } from "@/lib/bookings";
import type { GroomingDraftAvailability } from "@/lib/grooming-draft";
import type { Customer, PaymentCollectionType, PaymentMethod, Pet, Room, Service } from "@/types/database";

type BookingFormProps = {
  initialCustomers: Customer[];
  rooms: Room[];
  services: Service[];
};

type ImportPreviewState = {
  data: ImportedBookingChatData;
  warnings: string[];
};

type GuardState<T> = {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
  data: T | null;
};

const HALF_HOUR_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

function roundToHalfHour(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const roundedMinutes = minutes <= 30 ? 30 : 60;
  next.setMinutes(roundedMinutes);

  if (roundedMinutes === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  }

  return next;
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildDefaultDateRange() {
  const start = roundToHalfHour(new Date());
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    startAt: toDateTimeLocalValue(start),
    endAt: toDateTimeLocalValue(end)
  };
}

function getDatePart(value: string) {
  return value.split("T")[0] ?? "";
}

function getTimePart(value: string) {
  return value.split("T")[1] ?? "10:00";
}

function combineDateAndTime(datePart: string, timePart: string) {
  if (!datePart) {
    return "";
  }

  return `${datePart}T${timePart || "10:00"}`;
}

function getSelectableTimeOptions(currentValue: string) {
  if (!currentValue || HALF_HOUR_TIME_OPTIONS.includes(currentValue)) {
    return HALF_HOUR_TIME_OPTIONS;
  }

  return [...HALF_HOUR_TIME_OPTIONS, currentValue].sort((left, right) => left.localeCompare(right));
}

function normalizeComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s\-_/]+/g, "")
    .trim();
}

function normalizeSearchPhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function parseCustomerSearchDraft(value: string) {
  const raw = value.trim();

  if (!raw) {
    return {
      customerFullName: "",
      customerPhone: "",
      petName: ""
    };
  }

  const slashParts = raw
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (slashParts.length >= 2) {
    const phonePart = slashParts.find((part) => normalizeSearchPhone(part).length >= 8) ?? "";
    const textParts = slashParts.filter((part) => part !== phonePart);

    return {
      customerFullName: textParts[0] ?? "",
      petName: textParts[1] ?? "",
      customerPhone: phonePart
    };
  }

  const phoneOnly = normalizeSearchPhone(raw);

  if (phoneOnly.length >= 8) {
    return {
      customerFullName: "",
      customerPhone: raw,
      petName: ""
    };
  }

  return {
    customerFullName: "",
    customerPhone: "",
    petName: ""
  };
}

function getSpeciesLabel(value: string) {
  if (value === "dog") {
    return "สุนัข";
  }

  if (value === "cat") {
    return "แมว";
  }

  return value || "ไม่ระบุ";
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("th-TH").format(amount);
}

function mergeById<T extends { id: string }>(nextItems: T[], currentItems: T[]) {
  const map = new Map<string, T>();

  for (const item of nextItems) {
    map.set(item.id, item);
  }

  for (const item of currentItems) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

function findMatchingService(serviceText: string, services: Service[]) {
  const normalizedTarget = normalizeComparison(serviceText);
  const groomingServices = services.filter((service) => service.category !== "hotel");

  const exactMatches = groomingServices.filter((service) => normalizeComparison(service.name) === normalizedTarget);

  if (exactMatches.length === 1) {
    return {
      matchedService: exactMatches[0],
      warnings: [] as string[]
    };
  }

  const looseMatches = groomingServices.filter((service) => {
    const normalizedName = normalizeComparison(service.name);
    return normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName);
  });

  if (looseMatches.length === 1) {
    return {
      matchedService: looseMatches[0],
      warnings: [] as string[]
    };
  }

  if (looseMatches.length > 1 || exactMatches.length > 1) {
    return {
      matchedService: null,
      warnings: [`พบหลายบริการที่ใกล้เคียงกับ "${serviceText}" กรุณาเลือกบริการหลักเอง`]
    };
  }

  return {
    matchedService: null,
    warnings: [`ยังจับคู่บริการจากข้อความ "${serviceText}" ไม่ได้ กรุณาเลือกบริการหลักเอง`]
  };
}

function buildImportedContextNote(data: ImportedBookingChatData) {
  if (data.serviceType === "grooming") {
    return [`Imported grooming service: ${data.serviceText}`].join("\n");
  }

  const parts = [
    data.additionalServiceText ? `Imported additional service: ${data.additionalServiceText}` : "",
    data.stayNights ? `Imported stay nights: ${data.stayNights}` : ""
  ].filter(Boolean);

  return parts.join("\n");
}

function formatDateTimeSummary(value: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function FieldMessage({
  tone,
  children
}: {
  tone: "danger" | "warning" | "success";
  children: ReactNode;
}) {
  return <div className={`state-note state-note-${tone}`}>{children}</div>;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary" type="submit" disabled={pending || disabled}>
      {pending ? "กำลังบันทึก..." : "บันทึกการจอง"}
    </button>
  );
}

function ReviewButton({
  disabled,
  onClick
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button className="btn btn-primary" type="button" onClick={onClick} disabled={disabled}>
      ตรวจสอบก่อนบันทึก
    </button>
  );
}

export function BookingForm({ initialCustomers, rooms, services }: BookingFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const defaults = useMemo(() => buildDefaultDateRange(), []);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [pets, setPets] = useState<Pet[]>([]);
  const hasExistingCustomers = customers.length > 0;

  const groomingServices = useMemo(() => services.filter((service) => service.category !== "hotel"), [services]);
  const hotelServices = useMemo(() => services.filter((service) => service.category === "hotel"), [services]);
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

  const [bookingType, setBookingType] = useState<"grooming" | "hotel">("grooming");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(hasExistingCustomers ? "existing" : "new");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLookupStatus, setCustomerLookupStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [petLookupStatus, setPetLookupStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [customerId, setCustomerId] = useState("");
  const [primaryPetId, setPrimaryPetId] = useState("");
  const [secondaryPetId, setSecondaryPetId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startAt, setStartAt] = useState(defaults.startAt);
  const [endAt, setEndAt] = useState(defaults.endAt);
  const [manualTotalAmount, setManualTotalAmount] = useState("");
  const [note, setNote] = useState("");
  const [importedContextNote, setImportedContextNote] = useState("");
  const [paymentCollectionType, setPaymentCollectionType] = useState<PaymentCollectionType>("none");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [customerFullName, setCustomerFullName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerFacebookName, setCustomerFacebookName] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("cat");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetWeightKg, setNewPetWeightKg] = useState("");
  const [newPetTemperamentNote, setNewPetTemperamentNote] = useState("");
  const [newPetAllergyNote, setNewPetAllergyNote] = useState("");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [importError, setImportError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [showPaymentNow, setShowPaymentNow] = useState(false);
  const [showSecondaryPet, setShowSecondaryPet] = useState(false);
  const [hotelRoomState, setHotelRoomState] = useState<GuardState<AvailableRoomOption[]>>({
    status: "idle",
    message: "",
    data: null
  });
  const [groomingGuardState, setGroomingGuardState] = useState<GuardState<GroomingDraftAvailability>>({
    status: "idle",
    message: "",
    data: null
  });
  const [roomSelectionNotice, setRoomSelectionNotice] = useState("");

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setCustomerLookupStatus("loading");

      try {
        const nextCustomers = await searchCustomers(customerSearch, customerSearch.trim() ? 50 : 25);

        if (!active) {
          return;
        }

        setCustomers(nextCustomers);
        setCustomerLookupStatus("ready");
      } catch {
        if (active) {
          setCustomerLookupStatus("error");
        }
      }
    }, customerSearch.trim() ? 250 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerSearch]);

  const filteredCustomers = useMemo(() => {
    return customers;
  }, [customers]);

  useEffect(() => {
    if (!hasExistingCustomers && customerMode !== "new") {
      const timer = window.setTimeout(() => {
        setCustomerMode("new");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [customerMode, hasExistingCustomers]);

  useEffect(() => {
    if (customerMode !== "existing") {
      return;
    }

    if (!customerSearch.trim()) {
      return;
    }

    if (customerLookupStatus !== "loading" && filteredCustomers.length === 0) {
      const importDraft = importPreview?.data;
      const draft = parseCustomerSearchDraft(customerSearch);
      const nextCustomerFullName =
        !customerFullName.trim() && importDraft?.customerName
          ? importDraft.customerName
          : !customerFullName.trim() && !importDraft?.customerName && draft.customerFullName
            ? draft.customerFullName
            : null;
      const nextCustomerPhone =
        !customerPhone.trim() && importDraft?.phone
          ? importDraft.phone
          : !customerPhone.trim() && !importDraft?.phone && draft.customerPhone
            ? draft.customerPhone
            : null;
      const nextPetName =
        !newPetName.trim() && importDraft?.petName
          ? importDraft.petName
          : !newPetName.trim() && !importDraft?.petName && draft.petName
            ? draft.petName
            : null;

      const timer = window.setTimeout(() => {
        if (nextCustomerFullName) {
          setCustomerFullName(nextCustomerFullName);
        }

        if (nextCustomerPhone) {
          setCustomerPhone(nextCustomerPhone);
        }

        if (nextPetName) {
          setNewPetName(nextPetName);
        }

        setCustomerMode("new");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [customerFullName, customerLookupStatus, customerMode, customerPhone, customerSearch, filteredCustomers.length, importPreview, newPetName]);

  const resolvedCustomerId =
    customerMode === "existing" && filteredCustomers.some((customer) => customer.id === customerId) ? customerId : "";

  const availablePrimaryPets = useMemo(
    () => pets.filter((pet) => pet.customer_id === resolvedCustomerId),
    [pets, resolvedCustomerId]
  );

  useEffect(() => {
    if (!resolvedCustomerId) {
      const timer = window.setTimeout(() => {
        setPetLookupStatus("idle");
      }, 0);

      return () => window.clearTimeout(timer);
    }

    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (active) {
        setPetLookupStatus("loading");
      }
    }, 0);

    getCustomerPets(resolvedCustomerId)
      .then((nextPets) => {
        if (!active) {
          return;
        }

        setPets((current) => mergeById(nextPets, current));
        setPetLookupStatus("ready");
      })
      .catch(() => {
        if (active) {
          setPetLookupStatus("error");
        }
      });

    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
    };
  }, [resolvedCustomerId]);

  const resolvedPrimaryPetId = availablePrimaryPets.some((pet) => pet.id === primaryPetId) ? primaryPetId : "";

  const availableSecondaryPets = useMemo(
    () => availablePrimaryPets.filter((pet) => pet.id !== resolvedPrimaryPetId),
    [availablePrimaryPets, resolvedPrimaryPetId]
  );

  const resolvedSecondaryPetId = availableSecondaryPets.some((pet) => pet.id === secondaryPetId) ? secondaryPetId : "";

  const selectedService = useMemo(
    () => groomingServices.find((service) => service.id === serviceId) ?? hotelServices.find((service) => service.id === serviceId) ?? null,
    [groomingServices, hotelServices, serviceId]
  );

  const resolvedCustomer = customers.find((customer) => customer.id === resolvedCustomerId) ?? null;
  const resolvedPrimaryPet = availablePrimaryPets.find((pet) => pet.id === resolvedPrimaryPetId) ?? null;
  const resolvedSecondaryPet = availableSecondaryPets.find((pet) => pet.id === resolvedSecondaryPetId) ?? null;

  const isGrooming = bookingType === "grooming";
  const isHotel = bookingType === "hotel";
  const canAddSecondaryPet = Boolean(resolvedPrimaryPetId && availableSecondaryPets.length);

  useEffect(() => {
    if (!showSecondaryPet || canAddSecondaryPet) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowSecondaryPet(false);
      setSecondaryPetId("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canAddSecondaryPet, showSecondaryPet]);

  const effectiveEndAt = useMemo(() => {
    if (!isGrooming) {
      return endAt;
    }

    const durationMinutes = selectedService?.duration_minutes ?? 60;
    const nextEnd = new Date(startAt);

    if (Number.isNaN(nextEnd.getTime())) {
      return endAt;
    }

    nextEnd.setMinutes(nextEnd.getMinutes() + durationMinutes);
    return toDateTimeLocalValue(nextEnd);
  }, [endAt, isGrooming, selectedService?.duration_minutes, startAt]);

  const computedTotalAmount = manualTotalAmount;
  const totalAmountNumber = Number(computedTotalAmount || 0);
  const receivedAmountNumber = Number(receivedAmount || 0);
  const selectedPetCount = customerMode === "existing" && showSecondaryPet && resolvedSecondaryPetId ? 2 : 1;
  const hotelDateValidation = validateHotelStayDates(startAt, effectiveEndAt);
  const paymentValidation = validatePaymentDraft({
    showPaymentNow,
    paymentCollectionType,
    totalAmount: totalAmountNumber,
    receivedAmount: receivedAmountNumber
  });

  const groomingPetIds = useMemo(() => {
    if (customerMode !== "existing") {
      return [] as string[];
    }

    return [resolvedPrimaryPetId, showSecondaryPet ? resolvedSecondaryPetId : ""].filter(Boolean);
  }, [customerMode, resolvedPrimaryPetId, resolvedSecondaryPetId, showSecondaryPet]);

  const availableRoomChoices = useMemo(
    () =>
      (hotelRoomState.data ?? []).map((room) => ({
        ...room,
        max_pets: roomById.get(room.room_id)?.max_pets ?? 1
      })),
    [hotelRoomState.data, roomById]
  );

  const eligibleRooms = useMemo(
    () => availableRoomChoices.filter((room) => room.max_pets >= selectedPetCount),
    [availableRoomChoices, selectedPetCount]
  );
  const displayedEligibleRooms = isHotel && hotelDateValidation.ok ? eligibleRooms : [];

  const selectedRoom = eligibleRooms.find((room) => room.room_id === roomId) ?? null;

  useEffect(() => {
    if (!isHotel || !hotelDateValidation.ok) {
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setHotelRoomState((current) => ({
        status: "loading",
        message: current.data?.length ? "กำลังอัปเดตรายการห้องว่าง..." : "กำลังเช็กห้องว่าง...",
        data: current.data
      }));

      try {
        const nextRooms = await getAvailableRooms(startAt, effectiveEndAt);

        if (!active) {
          return;
        }

        setHotelRoomState({
          status: "ready",
          message: nextRooms.length ? `พบห้องว่าง ${nextRooms.length} ห้อง` : "ช่วงวันที่นี้ไม่มีห้องว่าง",
          data: nextRooms
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setHotelRoomState({
          status: "error",
          message: error instanceof Error ? error.message : "ไม่สามารถเช็กห้องว่างได้",
          data: []
        });
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [effectiveEndAt, hotelDateValidation.message, hotelDateValidation.ok, isHotel, startAt]);

  useEffect(() => {
    if (!isHotel || !roomId) {
      return;
    }

    if (!eligibleRooms.some((room) => room.room_id === roomId)) {
      const timer = window.setTimeout(() => {
        setRoomId("");

        if (availableRoomChoices.some((room) => room.room_id === roomId)) {
          setRoomSelectionNotice(`ห้องเดิมรองรับสัตว์เลี้ยง ${selectedPetCount} ตัวไม่พอ กรุณาเลือกห้องใหม่`);
        } else {
          setRoomSelectionNotice("ห้องที่เลือกไว้ไม่ว่างแล้ว กรุณาเลือกห้องใหม่");
        }
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [availableRoomChoices, eligibleRooms, isHotel, roomId, selectedPetCount]);

  useEffect(() => {
    if (!isGrooming || !startAt || !effectiveEndAt) {
      return;
    }

    if (customerMode === "existing" && !resolvedPrimaryPetId) {
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setGroomingGuardState({
        status: "loading",
        message: "กำลังเช็กคิว grooming...",
        data: null
      });

      try {
        const result = await checkGroomingAvailability({
          startAt,
          endAt: effectiveEndAt,
          petIds: groomingPetIds
        });

        if (!active) {
          return;
        }

        setGroomingGuardState({
          status: result.ok ? "ready" : "error",
          message: result.message,
          data: result
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setGroomingGuardState({
          status: "error",
          message: error instanceof Error ? error.message : "ไม่สามารถเช็กคิว grooming ได้",
          data: null
        });
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerMode, effectiveEndAt, groomingPetIds, isGrooming, resolvedPrimaryPetId, startAt]);

  function resetFormState() {
    const nextDefaults = buildDefaultDateRange();
    setCustomers(initialCustomers);
    setPets([]);
    setBookingType("grooming");
    setCustomerMode(initialCustomers.length ? "existing" : "new");
    setCustomerSearch("");
    setCustomerLookupStatus("idle");
    setPetLookupStatus("idle");
    setCustomerId("");
    setPrimaryPetId("");
    setSecondaryPetId("");
    setRoomId("");
    setServiceId("");
    setStartAt(nextDefaults.startAt);
    setEndAt(nextDefaults.endAt);
    setManualTotalAmount("");
    setNote("");
    setImportedContextNote("");
    setPaymentCollectionType("none");
    setPaymentMethod("transfer");
    setReceivedAmount("");
    setPaymentNote("");
    setCustomerFullName("");
    setCustomerPhone("");
    setCustomerFacebookName("");
    setCustomerNote("");
    setNewPetName("");
    setNewPetSpecies("cat");
    setNewPetBreed("");
    setNewPetWeightKg("");
    setNewPetTemperamentNote("");
    setNewPetAllergyNote("");
    setImportText("");
    setImportPreview(null);
    setImportError("");
    setFormError("");
    setIsImportOpen(false);
    setIsDetailsOpen(false);
    setIsReviewOpen(false);
    setShowPaymentNow(false);
    setShowSecondaryPet(false);
    setHotelRoomState({
      status: "idle",
      message: "",
      data: null
    });
    setGroomingGuardState({
      status: "idle",
      message: "",
      data: null
    });
    setRoomSelectionNotice("");
  }

  async function applyImportedCustomer(data: ImportedBookingChatData) {
    const lookupQuery = data.phone || data.customerName || data.petName;
    const nextCustomers = await searchCustomers(lookupQuery, 50);
    const matchedCustomer = nextCustomers.find((customer) => normalizePhone(customer.phone) === data.normalizedPhone) ?? null;
    const matchedCustomerPets = matchedCustomer ? await getCustomerPets(matchedCustomer.id) : [];
    const matchedPet =
      matchedCustomerPets.find((pet) => normalizeComparison(pet.name) === normalizeComparison(data.petName)) ?? null;

    setCustomers(nextCustomers);
    setPets((current) => mergeById(matchedCustomerPets, current));
    setCustomerSearch(`${data.customerName} ${data.petName} ${data.phone}`.trim());

    if (matchedCustomer && matchedPet) {
      setCustomerMode("existing");
      setCustomerId(matchedCustomer.id);
      setPrimaryPetId(matchedPet.id);
      return;
    }

    setCustomerMode("new");
    setCustomerFullName(matchedCustomer?.full_name ?? data.customerName);
    setCustomerPhone(matchedCustomer?.phone ?? data.phone);
    setCustomerFacebookName(matchedCustomer?.facebook_name ?? "");
    setCustomerNote(matchedCustomer?.note ?? "");
    setNewPetName(data.petName);
    setNewPetSpecies(data.speciesHint ?? "cat");
  }

  async function handleImport() {
    const parsed = parseImportedBookingChat(importText);

    setImportError("");
    setFormError("");
    setFormSuccess("");

    if (!parsed.success) {
      setImportPreview(null);
      setImportError(parsed.error);
      setIsImportOpen(true);
      return;
    }

    const warnings = [...parsed.warnings];
    const { data } = parsed;

    setImportPreview({ data, warnings: parsed.warnings });
    setImportedContextNote(buildImportedContextNote(data));
    setBookingType(data.serviceType);
    setIsImportOpen(true);
    try {
      await applyImportedCustomer(data);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Unable to lookup imported customer");
      setCustomerMode("new");
      setCustomerFullName(data.customerName);
      setCustomerPhone(data.phone);
      setNewPetName(data.petName);
      setNewPetSpecies(data.speciesHint ?? "cat");
    }

    if (data.depositAmount) {
      setPaymentCollectionType("deposit");
      setReceivedAmount(String(data.depositAmount));
      setPaymentNote("มัดจำจากข้อความยืนยันการจอง");
      setShowPaymentNow(true);
      setIsDetailsOpen(true);
    }

    if (data.serviceType === "grooming") {
      setStartAt(data.appointmentDateTime.replace(" ", "T"));

      const serviceMatch = findMatchingService(data.serviceText, services);
      warnings.push(...serviceMatch.warnings);
      setServiceId(serviceMatch.matchedService?.id ?? "");
      setManualTotalAmount("");
    } else {
      const checkInTime = getTimePart(startAt);
      const checkOutTime = getTimePart(effectiveEndAt);
      setStartAt(combineDateAndTime(data.checkInDate, checkInTime));
      setEndAt(combineDateAndTime(data.checkOutDate, checkOutTime));
      setManualTotalAmount(data.totalAmount ? String(data.totalAmount) : "");
      setRoomId("");
      warnings.push("ต้องเลือกห้องพักก่อนบันทึก");
    }

    setImportPreview({
      data,
      warnings
    });

    if (buildImportedContextNote(data)) {
      setIsDetailsOpen(true);
    }
  }

  async function handleSubmit(formData: FormData) {
    setFormError("");
    setFormSuccess("");

    try {
      await createBooking(formData);
      resetFormState();
      setFormSuccess("บันทึกการจองเรียบร้อยแล้ว");
      showToast();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "ไม่สามารถบันทึกการจองได้");
    }
  }

  const hotelCheckInDate = getDatePart(startAt);
  const hotelCheckOutDate = getDatePart(effectiveEndAt);
  const hotelCheckInTime = getTimePart(startAt);
  const hotelCheckOutTime = getTimePart(endAt);
  const groomingTimeOptions = getSelectableTimeOptions(getTimePart(startAt));

  function updateGroomingDate(datePart: string) {
    if (!datePart) {
      return;
    }

    setStartAt(combineDateAndTime(datePart, getTimePart(startAt)));
  }

  function updateHotelCheckInDate(datePart: string) {
    if (!datePart) {
      return;
    }

    setStartAt(combineDateAndTime(datePart, hotelCheckInTime));
  }

  function updateHotelCheckOutDate(datePart: string) {
    if (!datePart) {
      return;
    }

    setEndAt(combineDateAndTime(datePart, hotelCheckOutTime));
  }

  const customerReady =
    customerMode === "existing"
      ? Boolean(resolvedCustomerId && resolvedPrimaryPetId)
      : Boolean(customerFullName && customerPhone && newPetName && newPetSpecies);

  const customerStatusMessage =
    customerMode === "existing"
      ? resolvedCustomer && resolvedPrimaryPet
        ? `พร้อมใช้ข้อมูล ${resolvedCustomer.full_name} / ${resolvedPrimaryPet.name}`
        : "กรุณาเลือกลูกค้าและสัตว์เลี้ยง"
      : customerFullName && customerPhone && newPetName
        ? `พร้อมสร้างข้อมูลใหม่ให้ ${customerFullName} / ${newPetName}`
        : "กรุณากรอกข้อมูลลูกค้าและสัตว์เลี้ยงใหม่ให้ครบ";

  const hotelRoomGuard = (() => {
    if (!isHotel) {
      return { ok: true, blocking: false, message: "" };
    }

    if (!hotelDateValidation.ok) {
      return { ok: false, blocking: true, message: hotelDateValidation.message };
    }

    if (hotelRoomState.status === "loading") {
      return { ok: false, blocking: true, message: hotelRoomState.message || "กำลังเช็กห้องว่าง..." };
    }

    if (hotelRoomState.status === "error") {
      return { ok: false, blocking: true, message: hotelRoomState.message || "ไม่สามารถเช็กห้องว่างได้" };
    }

    if (!availableRoomChoices.length) {
      return { ok: false, blocking: true, message: "ช่วงวันที่นี้ไม่มีห้องว่าง" };
    }

    if (!eligibleRooms.length) {
      return {
        ok: false,
        blocking: true,
        message: `มีห้องว่าง แต่ยังไม่มีห้องที่รองรับสัตว์เลี้ยง ${selectedPetCount} ตัว`
      };
    }

    if (!roomId) {
      return { ok: false, blocking: true, message: "กรุณาเลือกห้องพักที่พร้อมใช้งาน" };
    }

    if (!selectedRoom) {
      return { ok: false, blocking: true, message: roomSelectionNotice || "กรุณาเลือกห้องพักใหม่" };
    }

    return {
      ok: true,
      blocking: false,
      message: `ห้อง ${selectedRoom.code} - ${selectedRoom.name} พร้อมใช้งาน`
    };
  })();

  const groomingGuard = (() => {
    if (!isGrooming) {
      return { ok: true, blocking: false, message: "" };
    }

    if (groomingGuardState.status === "loading") {
      return { ok: false, blocking: true, message: groomingGuardState.message };
    }

    if (groomingGuardState.status === "error") {
      return { ok: false, blocking: true, message: groomingGuardState.message || "มีคิว grooming ซ้อน" };
    }

    if (groomingGuardState.data) {
      return {
        ok: groomingGuardState.data.ok,
        blocking: !groomingGuardState.data.ok,
        message: groomingGuardState.data.message
      };
    }

    return { ok: false, blocking: true, message: "กำลังรอเช็กคิว grooming" };
  })();

  const bookingSummaryItems = [
    {
      label: "ลูกค้า",
      value: customerMode === "existing" ? resolvedCustomer?.full_name || "ยังไม่เลือก" : customerFullName || "ยังไม่กรอก"
    },
    {
      label: "สัตว์เลี้ยง",
      value:
        customerMode === "existing"
          ? [resolvedPrimaryPet?.name, showSecondaryPet ? resolvedSecondaryPet?.name : ""].filter(Boolean).join(", ") || "ยังไม่เลือก"
          : newPetName || "ยังไม่กรอก"
    },
    {
      label: "ประเภทคิว",
      value: isGrooming ? "Grooming" : "Hotel"
    },
    {
      label: "ช่วงเวลา",
      value: isGrooming
        ? `${formatDateTimeSummary(startAt)} - ${formatDateTimeSummary(effectiveEndAt)}`
        : `${formatDateTimeSummary(startAt)} ถึง ${formatDateTimeSummary(effectiveEndAt)}`
    },
    {
      label: isGrooming ? "บริการหลัก" : "ห้องพัก",
      value: isGrooming
        ? selectedService?.name || "ยังไม่เลือก"
        : selectedRoom
          ? `${selectedRoom.code} - ${selectedRoom.name}`
          : "ยังไม่เลือก"
    },
    {
      label: "ยอดเงิน",
      value:
        totalAmountNumber > 0
          ? `${formatCurrency(totalAmountNumber)} บาท${showPaymentNow ? ` / รับแล้ว ${formatCurrency(receivedAmountNumber)} บาท` : ""}`
          : showPaymentNow && receivedAmountNumber > 0
            ? `รับแล้ว ${formatCurrency(receivedAmountNumber)} บาท`
            : "ยังไม่สรุปยอด"
    }
  ];

  const checklist = [
    {
      label: "ลูกค้าและสัตว์เลี้ยง",
      ok: customerReady,
      message: customerStatusMessage
    },
    {
      label: isGrooming ? "บริการและเวลา" : "วันเข้าพัก",
      ok: isGrooming ? Boolean(serviceId && startAt && effectiveEndAt) : hotelDateValidation.ok,
      message: isGrooming
        ? serviceId
          ? `บริการ ${selectedService?.name || "ถูกเลือกแล้ว"}`
          : "กรุณาเลือกบริการหลัก"
        : hotelDateValidation.message
    },
    {
      label: isGrooming ? "คิวซ้อน" : "ห้องพักพร้อมใช้งาน",
      ok: isGrooming ? groomingGuard.ok : hotelRoomGuard.ok,
      message: isGrooming ? groomingGuard.message : hotelRoomGuard.message
    },
    {
      label: "การรับเงิน",
      ok: paymentValidation.ok,
      message: paymentValidation.message
    }
  ];

  const canSubmit =
    customerReady &&
    Boolean(startAt && effectiveEndAt) &&
    (isGrooming ? Boolean(serviceId) : Boolean(roomId)) &&
    !groomingGuard.blocking &&
    !hotelRoomGuard.blocking &&
    !paymentValidation.blocking;

  return (
    <form action={handleSubmit} className="stack booking-form-shell">
      <section className="form-section booking-toolbar">
        <div>
          <p className="section-kicker">Front Desk Flow</p>
          <h2 className="form-section-title">สร้างคิวใหม่</h2>
          <p className="form-section-copy">โฟกัสเฉพาะข้อมูลที่ต้องใช้สร้างคิวก่อน และเตือนจุดเสี่ยงให้ครบก่อนบันทึก</p>
        </div>
        <div className="booking-toolbar-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setIsImportOpen((open) => !open)}
          >
            วางข้อความยืนยันการจอง
          </button>
          <Link className="btn btn-ghost" href="/schedule">
            ดูตารางคิว
          </Link>
        </div>

        {isImportOpen ? (
          <div className="booking-utility">
            <label className="label">
              ข้อความจากแชท
              <textarea
                className="textarea"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="วางข้อความยืนยันการจองที่นี่"
              />
            </label>
            <div className="btn-row">
              <button className="btn btn-primary" type="button" onClick={handleImport}>
                Import ข้อความ
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setImportText("")}>
                ล้างข้อความ
              </button>
            </div>

            {importError ? <FieldMessage tone="danger">{importError}</FieldMessage> : null}

            {importPreview ? (
              <div className="soft-note">
                <strong>นำเข้าข้อมูลแล้ว</strong>
                <p className="label-hint">ระบบเติมข้อมูลให้ในฟอร์มแล้ว และจะให้ตรวจสอบอีกครั้งตอนกดบันทึกการจอง</p>

                {importPreview.warnings.length ? (
                  <FieldMessage tone="warning">
                    {importPreview.warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </FieldMessage>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="form-section">
        <div>
          <p className="section-kicker">Step 1</p>
          <h2 className="form-section-title">ลูกค้าและสัตว์เลี้ยง</h2>
          <p className="form-section-copy">ค้นหาจากชื่อลูกค้า ชื่อน้อง หรือเบอร์โทรก่อน ถ้าไม่เจอค่อยเพิ่มใหม่</p>
        </div>

        <label className="label">
          ค้นหา
          <input
            className="input"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="เช่น คุณซิสตร้า / น้องอุนจิ / 0650170175"
          />
        </label>

        <div className="btn-row">
          <button
            className={`btn ${customerMode === "existing" ? "btn-primary" : "btn-secondary"}`}
            type="button"
            onClick={() => setCustomerMode("existing")}
          >
            ใช้ข้อมูลเดิม
          </button>
          <button
            className={`btn ${customerMode === "new" ? "btn-primary" : "btn-secondary"}`}
            type="button"
            onClick={() => setCustomerMode("new")}
          >
            เพิ่มลูกค้าใหม่
          </button>
        </div>

        {customerMode === "existing" ? (
          <div className="stack">
            <div className="grid-2">
              <label className="label">
                ลูกค้า
                <select
                  className="select"
                  name="customerId"
                  value={resolvedCustomerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setPrimaryPetId("");
                    setSecondaryPetId("");
                    setShowSecondaryPet(false);
                  }}
                  required
                >
                  <option value="">
                    {customerLookupStatus === "loading" ? "กำลังค้นหา..." : filteredCustomers.length ? "เลือกลูกค้า" : "ไม่พบลูกค้าที่ตรงกับการค้นหา"}
                  </option>
                  {filteredCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} {customer.phone ? `(${customer.phone})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="booking-pet-picker">
                <label className="label">
                  สัตว์เลี้ยง
                  <select
                    className="select"
                    name="petId"
                    value={resolvedPrimaryPetId}
                    onChange={(event) => {
                      setPrimaryPetId(event.target.value);
                      setSecondaryPetId("");
                      setShowSecondaryPet(false);
                    }}
                    required
                  >
                    <option value="">
                      {petLookupStatus === "loading" ? "กำลังโหลดสัตว์เลี้ยง..." : resolvedCustomerId ? "เลือกสัตว์เลี้ยง" : "เลือกลูกค้าก่อน"}
                    </option>
                    {availablePrimaryPets.map((pet) => (
                      <option key={pet.id} value={pet.id}>
                        {pet.name} ({getSpeciesLabel(pet.species)})
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="booking-add-pet-button"
                  type="button"
                  aria-expanded={showSecondaryPet}
                  aria-label={showSecondaryPet ? "ซ่อนสัตว์เลี้ยงตัวที่ 2" : "เพิ่มสัตว์เลี้ยงลงคิว"}
                  title={showSecondaryPet ? "ซ่อนสัตว์เลี้ยงตัวที่ 2" : "เพิ่มสัตว์เลี้ยงลงคิว"}
                  onClick={() => {
                    setShowSecondaryPet((open) => {
                      if (open) {
                        setSecondaryPetId("");
                      }

                      return !open;
                    });
                  }}
                  disabled={!canAddSecondaryPet}
                >
                  <Plus size={20} strokeWidth={2.7} />
                </button>
              </div>
            </div>

            {showSecondaryPet ? (
              <label className="label booking-secondary-pet-field">
                สัตว์เลี้ยงตัวที่ 2
                <select
                  className="select"
                  name="secondaryPetId"
                  value={resolvedSecondaryPetId}
                  onChange={(event) => setSecondaryPetId(event.target.value)}
                >
                  <option value="">ไม่เพิ่ม</option>
                  {availableSecondaryPets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} ({getSpeciesLabel(pet.species)})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="secondaryPetId" value="" />
            )}

            {resolvedCustomer && resolvedPrimaryPet ? (
              <div className="card panel-muted booking-summary-card">
                <strong>ข้อมูลที่ระบบจะใช้ตอนนี้</strong>
                <div className="booking-preview-grid">
                  <span>ลูกค้า: {resolvedCustomer.full_name}</span>
                  <span>เบอร์โทร: {resolvedCustomer.phone || "-"}</span>
                  <span>สัตว์เลี้ยง: {[resolvedPrimaryPet.name, showSecondaryPet ? resolvedSecondaryPet?.name : ""].filter(Boolean).join(", ")}</span>
                  <span>ประเภทสัตว์: {getSpeciesLabel(resolvedPrimaryPet.species)}</span>
                </div>
              </div>
            ) : null}

            {customerLookupStatus === "error" ? <FieldMessage tone="danger">ไม่สามารถค้นหาลูกค้าได้</FieldMessage> : null}
            {petLookupStatus === "error" ? <FieldMessage tone="danger">ไม่สามารถโหลดสัตว์เลี้ยงของลูกค้ารายนี้ได้</FieldMessage> : null}
            {!filteredCustomers.length && customerLookupStatus !== "loading" ? <FieldMessage tone="warning">ไม่พบลูกค้าที่ตรงกับคำค้น ลองเพิ่มลูกค้าใหม่แทน</FieldMessage> : null}
          </div>
        ) : (
          <div className="stack">
            <div className="grid-2">
              <label className="label">
                ชื่อลูกค้า
                <input
                  className="input"
                  name="customerFullName"
                  value={customerFullName}
                  onChange={(event) => setCustomerFullName(event.target.value)}
                  placeholder="ชื่อเจ้าของ"
                  required
                />
              </label>

              <label className="label">
                เบอร์โทร
                <input
                  className="input"
                  name="customerPhone"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="0812345678"
                  required
                />
              </label>
            </div>

            <div className="grid-2">
              <label className="label">
                ชื่อน้อง
                <input
                  className="input"
                  name="newPetName"
                  value={newPetName}
                  onChange={(event) => setNewPetName(event.target.value)}
                  placeholder="ชื่อน้อง"
                  required
                />
              </label>

              <label className="label">
                ประเภทสัตว์
                <select
                  className="select"
                  name="newPetSpecies"
                  value={newPetSpecies}
                  onChange={(event) => setNewPetSpecies(event.target.value)}
                  required
                >
                  <option value="cat">แมว</option>
                  <option value="dog">สุนัข</option>
                </select>
              </label>
            </div>

            {importPreview && customerMode === "new" ? (
              <FieldMessage tone="warning">ข้อความที่ import ยังจับคู่ลูกค้า/สัตว์เลี้ยงเดิมไม่ได้ ฟอร์มนี้จะสร้างข้อมูลใหม่เมื่อบันทึก</FieldMessage>
            ) : null}
          </div>
        )}
      </section>

      <section className="form-section">
        <div>
          <p className="section-kicker">Step 2</p>
          <h2 className="form-section-title">ข้อมูลคิว</h2>
          <p className="form-section-copy">เลือกประเภทคิว วันเวลา และบริการหลักที่ใช้สร้างรายการนี้</p>
        </div>

        <label className="label">
          ประเภทคิว
          <select
            className="select"
            name="bookingType"
            value={bookingType}
            onChange={(event) => {
              const nextType = event.target.value as "grooming" | "hotel";
              setBookingType(nextType);
              setServiceId("");
              setRoomId("");
              setRoomSelectionNotice("");
              setHotelRoomState({
                status: "idle",
                message: "",
                data: null
              });
              setGroomingGuardState({
                status: "idle",
                message: "",
                data: null
              });
            }}
          >
            <option value="grooming">Grooming</option>
            <option value="hotel">Hotel</option>
          </select>
        </label>

        {isGrooming ? (
          <div className="stack">
            <div className="grid-2">
              <label className="label">
                วันที่
                <input
                  className="input date-input-native"
                  type="date"
                  value={getDatePart(startAt)}
                  onChange={(event) => updateGroomingDate(event.target.value)}
                  required
                />
              </label>

              <label className="label">
                เวลา
                <select
                  className="select"
                  value={getTimePart(startAt)}
                  onChange={(event) => setStartAt(combineDateAndTime(getDatePart(startAt), event.target.value))}
                  required
                >
                  {groomingTimeOptions.map((timeOption) => (
                    <option key={timeOption} value={timeOption}>
                      {timeOption}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="label">
              บริการหลัก
              <select
                className="select"
                name="serviceId"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
                required
              >
                <option value="">เลือกบริการ</option>
                {groomingServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>

            {groomingGuard.message ? (
              <FieldMessage tone={groomingGuard.ok ? "success" : "warning"}>{groomingGuard.message}</FieldMessage>
            ) : null}
          </div>
        ) : (
          <div className="stack">
            <div className="grid-2">
              <label className="label">
                วันที่เช็กอิน
                <input
                  className="input date-input-native"
                  type="date"
                  value={hotelCheckInDate}
                  onChange={(event) => updateHotelCheckInDate(event.target.value)}
                  required
                />
              </label>

              <label className="label">
                วันที่เช็กเอาต์
                <input
                  className="input date-input-native"
                  type="date"
                  value={hotelCheckOutDate}
                  onChange={(event) => updateHotelCheckOutDate(event.target.value)}
                  required
                />
              </label>
            </div>

            {!hotelDateValidation.ok ? <FieldMessage tone="danger">{hotelDateValidation.message}</FieldMessage> : null}

            <label className="label">
              ห้องพัก
              <select
                className="select"
                name="roomId"
                value={roomId}
                onChange={(event) => {
                  setRoomId(event.target.value);
                  setRoomSelectionNotice("");
                }}
                required
                disabled={hotelRoomState.status === "loading" || !hotelDateValidation.ok || !displayedEligibleRooms.length}
              >
                <option value="">
                  {hotelRoomState.status === "loading"
                    ? "กำลังเช็กห้องว่าง..."
                    : !displayedEligibleRooms.length
                      ? "ยังไม่มีห้องที่เลือกได้"
                      : "เลือกห้องพัก"}
                </option>
                {displayedEligibleRooms.map((room) => (
                  <option key={room.room_id} value={room.room_id}>
                    {room.code} - {room.name} ({formatCurrency(room.nightly_rate)} บาท/คืน, สูงสุด {room.max_pets} ตัว)
                  </option>
                ))}
              </select>
            </label>

            {roomSelectionNotice ? <FieldMessage tone="warning">{roomSelectionNotice}</FieldMessage> : null}
            {hotelRoomGuard.message ? (
              <FieldMessage tone={hotelRoomGuard.ok ? "success" : "warning"}>{hotelRoomGuard.message}</FieldMessage>
            ) : null}
          </div>
        )}

        <input type="hidden" name="startAt" value={startAt} />
        <input type="hidden" name="endAt" value={effectiveEndAt} />
      </section>

      <details className="form-section booking-collapsible" open={isDetailsOpen} onToggle={(event) => setIsDetailsOpen(event.currentTarget.open)}>
        <summary className="booking-collapsible-summary">
          <div>
            <p className="section-kicker">Optional</p>
            <h2 className="form-section-title">รายละเอียดเพิ่มเติม</h2>
          </div>
          <span className="muted">เปิดเมื่ออยากเพิ่มหมายเหตุ รับเงิน หรือข้อมูลเสริม</span>
        </summary>

        <div className="stack">
            <label className="label">
              หมายเหตุคิว
              <textarea
                className="textarea"
                name="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="ข้อมูลที่อยากให้ทีมเห็นในคิวนี้"
              />
            </label>

          <label className="label">
            ยอดรวม
            <input
              className="input"
              inputMode="numeric"
              value={manualTotalAmount}
              onChange={(event) => setManualTotalAmount(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
            />
            <p className="label-hint">
              ปล่อยว่างได้ถ้ายังไม่สรุปยอด แต่ถ้าจะรับเงินควรระบุยอดรวมก่อน
            </p>
          </label>

          <div className="stack panel-muted card">
            <div className="list-card-top">
              <div>
                <strong>รับเงินตอนนี้</strong>
                <p className="label-hint">ไม่บังคับ แต่ถ้ารับเงินแล้วระบบจะเช็กความสัมพันธ์กับยอดรวมให้ทันที</p>
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowPaymentNow((open) => !open)}
              >
                {showPaymentNow ? "ซ่อน" : "เปิด"}
              </button>
            </div>

            {showPaymentNow ? (
              <div className="stack">
                <div className="grid-2">
                  <label className="label">
                    รูปแบบการรับเงิน
                    <select
                      className="select"
                      name="paymentCollectionType"
                      value={paymentCollectionType}
                      onChange={(event) => {
                        const nextType = event.target.value as PaymentCollectionType;
                        setPaymentCollectionType(nextType);

                        if (nextType === "full" && receivedAmount && !manualTotalAmount) {
                          setManualTotalAmount(receivedAmount);
                        }
                      }}
                    >
                      <option value="none">ยังไม่รับเงิน</option>
                      <option value="deposit">รับมัดจำ</option>
                      <option value="full">รับเต็มจำนวน</option>
                    </select>
                  </label>

                  <label className="label">
                    วิธีรับเงิน
                    <select
                      className="select"
                      name="paymentMethod"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    >
                      <option value="cash">เงินสด</option>
                      <option value="promptpay_qr">PromptPay QR</option>
                      <option value="transfer">โอนเงิน</option>
                      <option value="card">บัตร</option>
                      <option value="other">อื่น ๆ</option>
                    </select>
                  </label>
                </div>

                <div className="grid-2">
                  <label className="label">
                    จำนวนเงินที่รับ
                    <input
                      className="input"
                      name="receivedAmount"
                      inputMode="numeric"
                      value={receivedAmount}
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/[^\d]/g, "");
                        setReceivedAmount(nextValue);

                        if (paymentCollectionType === "full" && nextValue && !manualTotalAmount) {
                          setManualTotalAmount(nextValue);
                        }
                      }}
                      placeholder="0"
                    />
                  </label>

                  <label className="label">
                    หมายเหตุการรับเงิน
                    <input
                      className="input"
                      name="paymentNote"
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      placeholder="เช่น มัดจำจากแชท"
                    />
                  </label>
                </div>

                {importPreview?.data.depositAmount ? (
                  <FieldMessage tone="success">พบมัดจำจากข้อความนำเข้า {formatCurrency(importPreview.data.depositAmount)} บาท และเติมให้แล้ว</FieldMessage>
                ) : null}

                <div className="booking-payment-summary">
                  <span>ยอดรวม {formatCurrency(paymentValidation.totalAmount)} บาท</span>
                  <span>รับแล้ว {formatCurrency(paymentValidation.receivedAmount)} บาท</span>
                  <span>คงเหลือ {formatCurrency(paymentValidation.remainingAmount)} บาท</span>
                </div>

                <FieldMessage tone={paymentValidation.ok ? "success" : "warning"}>{paymentValidation.message}</FieldMessage>
              </div>
            ) : (
              <>
                <input type="hidden" name="paymentCollectionType" value="none" />
                <input type="hidden" name="paymentMethod" value="transfer" />
                <input type="hidden" name="receivedAmount" value="0" />
                <input type="hidden" name="paymentNote" value="" />
              </>
            )}
          </div>

          {isHotel && hotelServices.length ? (
            <label className="label">
              บริการโรงแรมเพิ่มเติม
              <select
                className="select"
                name="serviceId"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
              >
                <option value="">ไม่เลือกก็ได้</option>
                {hotelServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {customerMode === "new" ? (
            <div className="stack">
              <div className="grid-2">
                <label className="label">
                  Facebook ชื่อที่ใช้คุย
                  <input
                    className="input"
                    name="customerFacebookName"
                    value={customerFacebookName}
                    onChange={(event) => setCustomerFacebookName(event.target.value)}
                    placeholder="ไม่บังคับ"
                  />
                </label>

                <label className="label">
                  หมายเหตุลูกค้า
                  <input
                    className="input"
                    name="customerNote"
                    value={customerNote}
                    onChange={(event) => setCustomerNote(event.target.value)}
                    placeholder="ไม่บังคับ"
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="label">
                  สายพันธุ์
                  <input
                    className="input"
                    name="newPetBreed"
                    value={newPetBreed}
                    onChange={(event) => setNewPetBreed(event.target.value)}
                    placeholder="ไม่บังคับ"
                  />
                </label>

                <label className="label">
                  น้ำหนัก (กก.)
                  <input
                    className="input"
                    name="newPetWeightKg"
                    inputMode="decimal"
                    value={newPetWeightKg}
                    onChange={(event) => setNewPetWeightKg(event.target.value)}
                    placeholder="ไม่บังคับ"
                  />
                </label>
              </div>

              <div className="grid-2">
                <label className="label">
                  นิสัย / ข้อควรระวัง
                  <textarea
                    className="textarea"
                    name="newPetTemperamentNote"
                    value={newPetTemperamentNote}
                    onChange={(event) => setNewPetTemperamentNote(event.target.value)}
                    placeholder="ไม่บังคับ"
                  />
                </label>

                <label className="label">
                  การแพ้ / อาหารต้องระวัง
                  <textarea
                    className="textarea"
                    name="newPetAllergyNote"
                    value={newPetAllergyNote}
                    onChange={(event) => setNewPetAllergyNote(event.target.value)}
                    placeholder="ไม่บังคับ"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

      </details>

      <div className="booking-form-action booking-optional-action">
        {formError ? <FieldMessage tone="danger">{formError}</FieldMessage> : null}
        {formSuccess ? <FieldMessage tone="success">{formSuccess}</FieldMessage> : null}
        <ReviewButton disabled={false} onClick={() => setIsReviewOpen(true)} />
      </div>

      {isReviewOpen ? (
        <div className="booking-review-modal-overlay" role="presentation" onClick={() => setIsReviewOpen(false)}>
          <div
            className="booking-review-modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-review-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="booking-review-modal-head">
              <div>
                <p className="section-kicker">Review</p>
                <h2 id="booking-review-title" className="form-section-title">สรุปก่อนบันทึก</h2>
                <p className="form-section-copy">ดู snapshot ของข้อมูลหลักและเช็กรายการที่ต้องผ่านก่อนสร้างคิว</p>
              </div>
              <button className="btn btn-ghost booking-review-close" type="button" onClick={() => setIsReviewOpen(false)}>
                ปิด
              </button>
            </div>

            <div className="booking-review-grid">
              {bookingSummaryItems.map((item) => (
                <div key={item.label} className="card panel-muted booking-summary-card">
                  <div className="muted">{item.label}</div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="booking-checklist">
              {checklist.map((item) => (
                <div key={item.label} className={`booking-checklist-item ${item.ok ? "is-ok" : "is-blocking"}`}>
                  <strong>{item.label}</strong>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>

            <div className="booking-review-modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setIsReviewOpen(false)}>
                กลับไปแก้ไข
              </button>
              <SubmitButton disabled={!canSubmit} />
            </div>
          </div>
        </div>
      ) : null}

      <input type="hidden" name="customerMode" value={customerMode} />
      <input type="hidden" name="importedContextNote" value={importedContextNote} />
      <input type="hidden" name="totalAmount" value={computedTotalAmount} />
    </form>
  );
}
