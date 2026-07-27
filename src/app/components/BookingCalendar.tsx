import { useState, useEffect } from "react";
import emailjs from "@emailjs/browser";
import { Calendar } from "./ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Droplets, Flame, X } from "lucide-react";
import { toast } from "sonner";
import { projectId, publicAnonKey, supabase } from "../utils/supabase/info";

interface Booking {
  id: string;
  date: string;
  hour: number;
  clientName: string;
  clientEmail: string;
}

// Créneaux de 12h à 2h du matin (14 créneaux d'1h)
const TIME_SLOTS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];

const SUPABASE_HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
  "Content-Type": "application/json",
};

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function BookingCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Recharger les réservations à chaque changement de date
  useEffect(() => {
    fetchBookings();
  }, [selectedDate]);

  // Nettoyer le formulaire quand le Dialog se ferme
  useEffect(() => {
    if (!dialogOpen) {
      setClientName("");
      setClientEmail("");
    }
  }, [dialogOpen]);

  const fetchBookings = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/rest/v1/kv_store_2b20b999?select=value`,
        { headers: SUPABASE_HEADERS }
      );

      if (response.ok) {
        const rows = await response.json();
        const bookings = rows.map((row: any) => row.value);
        setBookings(bookings || []);
      } else {
        console.error("Failed to fetch bookings", response.status);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
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
    if (isSlotBooked(hour)) return;
    
    // Toggle slot selection
    setSelectedSlots(prevSlots => {
      if (prevSlots.includes(hour)) {
        return prevSlots.filter(slot => slot !== hour);
      } else {
        return [...prevSlots, hour];
      }
    });
  };

  const handleOpenDialog = () => {
    if (selectedSlots.length > 0) {
      setDialogOpen(true);
    }
  };

  const handleBooking = async () => {
    if (!selectedDate || selectedSlots.length === 0 || !clientName || !clientEmail) {
      console.error("Booking validation failed", { selectedDate, selectedSlots, clientName, clientEmail });
      return;
    }

    const dateStr = toLocalDateStr(selectedDate);
    const newBookings: Booking[] = selectedSlots.map(hour => ({
      id: `${Date.now()}-${hour}`,
      date: dateStr,
      hour,
      clientName,
      clientEmail,
    }));

    try {
      // Sauvegarder via supabase-js
      for (const booking of newBookings) {
        const { error: saveError } = await supabase
          .from("kv_store_2b20b999")
          .upsert({ key: `booking:${booking.id}`, value: booking });

        if (saveError) {
          console.error("Erreur sauvegarde:", saveError.message);
          toast.error("Erreur lors de la sauvegarde de la réservation");
          return;
        }
      }

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
      console.error("Error during booking:", error);
    }
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
              {loading ? (
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
                      disabled={isBooked}
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
                  disabled={!clientName || !clientEmail}
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