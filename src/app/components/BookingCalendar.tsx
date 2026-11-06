import { useState, useEffect } from "react";
import emailjs from "@emailjs/browser";
import { Calendar } from "./ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Droplets, Flame, X } from "lucide-react";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "../utils/supabase/info";
import { HOURS as TIME_SLOTS, hasTooManyConsecutiveHours as hasMoreThanTwoConsecutiveSlots, localDateKey as toLocalDateStr } from "../lib/bookingRules.mjs";

interface Booking {
  date: string;
  hour: number;
}

export function BookingCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Recharger les réservations à chaque changement de date
  useEffect(() => {
    void fetchBookings();
    const refresh = () => { if(document.visibilityState === "visible") void fetchBookings(); };
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return () => {window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  }, [selectedDate]);

  // Nettoyer le formulaire quand le Dialog se ferme
  useEffect(() => {
    if (!dialogOpen) {
      setClientName("");
      setClientEmail("");
    }
  }, [dialogOpen]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-2b20b999/bookings`,
        { headers: {Authorization:`Bearer ${publicAnonKey}`}, cache:"no-store",signal:AbortSignal.timeout(15000) }
      );

      if (response.ok) {
        const data = await response.json();
        if(!Array.isArray(data.bookings))throw Error("Calendrier incomplet");
        setBookings(data.bookings);setLoadError(false);
      } else {
        throw Error("Calendrier indisponible");
      }
    } catch (error) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const isSlotBooked = (hour: number) => {
    if (!selectedDate) return false;
    const dateStr = toLocalDateStr(selectedDate);
    return bookings.some(
      (booking) =>
        booking.date === dateStr &&
        Number(booking.hour) === hour
    );
  };

  const isSlotSelected = (hour: number) => {
    return selectedSlots.includes(hour);
  };

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlots([]);
  };

  const handleSlotClick = (hour: number) => {
    if (loading || loadError || saving || isSlotBooked(hour)) return;
    
    // Toggle slot selection
    setSelectedSlots(prevSlots => {
      if (prevSlots.includes(hour)) {
        return prevSlots.filter(slot => slot !== hour);
      } else {
        const nextSlots = [...prevSlots, hour];

        if (hasMoreThanTwoConsecutiveSlots(nextSlots)) {
          toast.error("Maximum 2 heures consécutives. Choisissez un autre créneau plus tard dans la journée.");
          return prevSlots;
        }

        return nextSlots;
      }
    });
  };

  const handleOpenDialog = () => {
    if (!loading && !loadError && !saving && selectedSlots.length > 0) {
      if (hasMoreThanTwoConsecutiveSlots(selectedSlots)) {
        toast.error("Vous ne pouvez pas réserver plus de 2 heures consécutives.");
        return;
      }
      setDialogOpen(true);
    }
  };

  const handleBooking = async () => {
    if (saving || loading || loadError || !selectedDate || selectedSlots.length === 0 || !clientName || !clientEmail) {
      return;
    }

    if (hasMoreThanTwoConsecutiveSlots(selectedSlots)) {
      toast.error("Vous ne pouvez pas réserver plus de 2 heures consécutives.");
      return;
    }

    const dateStr = toLocalDateStr(selectedDate);
    setSaving(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-2b20b999/bookings/batch`, {
        method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${publicAnonKey}`},
        body:JSON.stringify({date:dateStr,slots:selectedSlots,clientName,clientEmail}),
      });
      const result=await response.json();
      if(!response.ok || !result.success){await fetchBookings();setSelectedSlots([]);setDialogOpen(false);toast.error(result.error || "Impossible d’enregistrer. Actualisez le calendrier.");return;}

      // Envoyer l'email de confirmation (optionnel, ne bloque pas le succès)
      let emailSent = false;
      try {
        const slotsText = [...selectedSlots]
          .sort((a, b) => a - b)
          .map((h) => {
            const end = h === 23 ? "0h" : h === 1 ? "2h" : `${h + 1}h`;
            return `${h}h00 – ${end}00`;
          })
          .join(", ");

        await emailjs.send(
          "service_bain_sauna",
          "template_1da9iji",
          {
            client_name: clientName,
            client_email: clientEmail,
            date: selectedDate.toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            slots: slotsText,
          },
          "Po1cvlscPzVavD84k"
        );
        emailSent = true;
      } catch (e) {
        console.error("EmailJS erreur:", e);
      }

      if (emailSent) {
        toast.success("Réservation confirmée ! Un email de confirmation a été envoyé.");
      } else {
        toast.success("Réservation confirmée !");
      }

      // Recharger les réservations depuis la base
      await fetchBookings();
      
      // Fermer le Dialog et réinitialiser les créneaux
      setDialogOpen(false);
      setSelectedSlots([]);
    } catch (error) {
      toast.error("Enregistrement non confirmé. Actualisez avant de réessayer.");
      await fetchBookings();
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#2d3748] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-[#c9a66b] mb-4" style={{ fontFamily: 'serif' }}>
            Réservation
          </h1>
          
          {/* Bain Nordique & Sauna Display */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex items-center gap-2 px-6 py-3 bg-[#374151] rounded-lg border-2 border-[#c9a66b]">
              <Droplets className="w-6 h-6 text-[#c9a66b]" />
              <span className="text-[#c9a66b]">Bain Nordique</span>
            </div>
            <span className="text-[#c9a66b] text-2xl">&</span>
            <div className="flex items-center gap-2 px-6 py-3 bg-[#374151] rounded-lg border-2 border-[#c9a66b]">
              <Flame className="w-6 h-6 text-[#c9a66b]" />
              <span className="text-[#c9a66b]">Sauna</span>
            </div>
          </div>
          
          <p className="text-gray-300 mb-1">
            Réservez votre créneau par tranche d'une heure
          </p>
          <p className="text-[#c9a66b] text-sm">
            Gratuit - Compris dans le prix de votre séjour
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <Card className="lg:col-span-1 bg-[#374151] border-[#4b5563]">
            <CardHeader>
              <CardTitle className="text-[#c9a66b]">Sélectionnez une date</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border-[#4b5563]"
              />
            </CardContent>
          </Card>

          {/* Time Slots Section */}
          <Card className="lg:col-span-2 bg-[#374151] border-[#4b5563]">
            <CardHeader>
              <CardTitle className="text-[#c9a66b] flex items-center gap-3">
                <Droplets className="w-6 h-6" />
                <Flame className="w-6 h-6" />
                {selectedDate
                  ? `Créneaux disponibles - ${selectedDate.toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}`
                  : "Sélectionnez une date"}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Réservations disponibles de 12h à 2h du matin. À partir de 2h, le système de traitement et filtration se met en route pour le nettoyage de l'eau.
                <br />
                <span className="text-[#c9a66b]">Cliquez sur plusieurs créneaux pour une réservation multiple.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadError ? <div role="alert" className="text-white py-8">Calendrier indisponible. Aucune réservation ne peut être effectuée.<Button onClick={() => void fetchBookings()}>Réessayer</Button></div> : loading ? (
                <div className="text-center text-[#c9a66b] py-8">Chargement des réservations...</div>
              ) : (
                <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {TIME_SLOTS.map((hour) => {
                  const isBooked = isSlotBooked(hour);
                  const isSelected = isSlotSelected(hour);
                  return (
                    <button
                      key={`slot-${hour}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSlotClick(hour);
                      }}
                      disabled={isBooked || saving}
                      type="button"
                      className={`
                        p-4 rounded-lg border-2 transition-colors duration-200
                        ${
                          isBooked
                            ? "bg-[#4b5563] border-[#6b7280] text-gray-500 cursor-not-allowed opacity-50"
                            : isSelected
                            ? "bg-[#c9a66b] border-[#c9a66b] text-[#1f2937] cursor-pointer shadow-lg"
                            : "bg-[#2d3748] border-[#c9a66b] text-[#c9a66b] hover:bg-[#c9a66b] hover:text-[#1f2937] cursor-pointer"
                        }
                      `}
                    >
                      <div className="text-center">
                        <div>
                          {hour}h00 - {hour === 23 ? "0h" : hour === 1 ? "2h" : `${hour + 1}h`}00
                        </div>
                        <div className="text-sm opacity-80">
                          {isBooked ? "Réservé" : isSelected ? "Sélectionné" : "Disponible"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Bouton de validation */}
              {selectedSlots.length > 0 && (
                <div className="mt-6 flex items-center justify-between bg-[#2d3748] p-4 rounded-lg border-2 border-[#c9a66b]">
                  <div className="text-[#c9a66b]">
                    <span className="font-semibold">{selectedSlots.length}</span> créneau{selectedSlots.length > 1 ? 'x' : ''} sélectionné{selectedSlots.length > 1 ? 's' : ''}
                  </div>
                  <Button 
                    onClick={handleOpenDialog}
                    className="bg-[#c9a66b] text-[#1f2937] hover:bg-[#b8944d]"
                  >
                    Valider la sélection
                  </Button>
                </div>
              )}
              </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Règle de réservation */}
        <div className="mt-6 p-4 rounded-lg bg-[#374151] border border-[#c9a66b]/60 text-center">
          <p className="text-[#c9a66b] font-semibold mb-1">
            Maximum 2 heures consécutives
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Vous pouvez réserver plusieurs créneaux dans la même journée, mais jamais plus de 2 heures d'affilée.
            Si nous constatons plusieurs réservations permettant de dépasser cette limite, nous nous réservons le droit d'annuler les créneaux concernés.
          </p>
        </div>

        {/* Booking Modal - Version inline sans Portal */}
        {dialogOpen && selectedDate && selectedSlots.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDialogOpen(false)}
            />

            {/* Modal Content */}
            <div className="relative bg-[#374151] border-2 border-[#4b5563] rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              {/* Close Button */}
              <button
                onClick={() => setDialogOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="p-6 border-b border-[#4b5563]">
                <h2 className="text-[#c9a66b] flex items-center gap-2 text-xl">
                  <Droplets className="w-5 h-5" />
                  <Flame className="w-5 h-5" />
                  Confirmer votre réservation
                </h2>
                <div className="mt-4 text-gray-400">
                  <p className="mb-2">
                    Bain Nordique & Sauna - {selectedDate.toLocaleDateString("fr-FR")}
                  </p>
                  <div className="space-y-1">
                    {[...selectedSlots].sort((a, b) => a - b).map((hour, index) => (
                      <div key={`modal-slot-${hour}`} className="text-[#c9a66b] text-sm">
                        Créneau {index + 1}: {hour}h00 - {hour === 23 ? "0h" : hour === 1 ? "2h" : `${hour + 1}h`}00
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modal-name" className="text-gray-300">
                    Nom complet
                  </Label>
                  <Input
                    id="modal-name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="bg-[#2d3748] border-[#4b5563] text-gray-200 placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-email" className="text-gray-300">
                    Email
                  </Label>
                  <Input
                    id="modal-email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="jean@example.com"
                    className="bg-[#2d3748] border-[#4b5563] text-gray-200 placeholder:text-gray-500"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#4b5563] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-[#4b5563] text-gray-300 hover:bg-[#4b5563]"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleBooking}
                  disabled={!clientName || !clientEmail || saving || loading || loadError}
                  className="bg-[#c9a66b] text-[#1f2937] hover:bg-[#b8944d] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmer la réservation
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}