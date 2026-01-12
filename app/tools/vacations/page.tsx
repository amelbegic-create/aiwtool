import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client"; // Obavezan import za type-safety
import UserView from "./_components/UserView";
import AdminView from "./_components/AdminView";

export default async function VacationPage() {
    const session = await getServerSession(authOptions);
    
    // Provjera sesije
    if (!session?.user) {
        redirect("/login");
    }

    // FIX: Sigurno kastingovanje ID-a sesije da se izbjegne TS error
    const sessionUserId = (session.user as { id: string }).id;

    // Dohvatanje korisnika sa restoranima
    const user = await prisma.user.findUnique({
        where: { id: sessionUserId },
        include: {
            restaurants: {
                include: {
                    restaurant: true
                }
            }
        }
    });

    if (!user) {
        return <div className="p-10 text-red-500 font-bold">Greška: Korisnik nije pronađen u bazi.</div>;
    }

    // FIX: Ispravno poređenje Role enuma (rješava grešku "Role is not assignable...")
    const isGodMode = user.role === Role.SYSTEM_ARCHITECT || user.role === Role.SUPER_ADMIN;
    const isManager = user.role === Role.ADMIN || user.role === Role.MANAGER;

    // Dohvatanje praznika (sortirano)
    const blockedDaysRaw = await prisma.blockedDay.findMany({
        orderBy: { date: 'asc' }
    });
    
    // Mapiranje praznika u čist objekat za props
    const blockedDays = blockedDaysRaw.map(d => ({
        id: d.id,
        date: d.date,
        reason: d.reason
    }));

    // --- LOGIKA ZA ADMINA / MANAGERA ---
    if (isGodMode || isManager) {
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let userWhereClause: any = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let requestWhereClause: any = {};

        // Ako nije "Bog", vidi samo ljude iz svojih restorana
        if (!isGodMode) {
            const myRestaurantIds = user.restaurants.map(r => r.restaurantId);
            
            userWhereClause = {
                restaurants: {
                    some: { restaurantId: { in: myRestaurantIds } }
                }
            };

            requestWhereClause = {
                user: {
                    restaurants: {
                        some: { restaurantId: { in: myRestaurantIds } }
                    }
                }
            };
        }

        // Dohvati sve zahtjeve
        const allRequestsRaw = await prisma.vacationRequest.findMany({
            where: requestWhereClause,
            include: { 
                user: {
                    include: {
                        restaurants: { include: { restaurant: true } }
                    }
                } 
            },
            orderBy: { createdAt: 'desc' }
        });

        // Formatiranje zahtjeva za AdminView
        const allRequests = allRequestsRaw.map(req => ({
            id: req.id,
            start: req.start,
            end: req.end,
            days: req.days,
            status: req.status,
            user: {
                name: req.user.name,
                email: req.user.email,
                // Uzimamo prvi restoran kao glavni za prikaz
                mainRestaurant: req.user.restaurants[0]?.restaurant.name || 'N/A'
            }
        }));

        // Dohvati statistiku za sve relevantne korisnike
        const allUsers = await prisma.user.findMany({
            where: userWhereClause,
            include: {
                vacations: { where: { status: 'APPROVED' } },
                restaurants: { include: { restaurant: true } }
            },
            orderBy: { name: 'asc' }
        });

        // Priprema statistike (šaljemo niz imena restorana za layout fix)
        const usersStats = allUsers.map(u => {
            const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
            
            // Kreiramo niz imena
            const restaurantNames = u.restaurants.map(r => r.restaurant.name || "Nepoznat");
            
            return {
                id: u.id,
                name: u.name,
                restaurantNames: restaurantNames, // Niz šaljemo klijentu
                department: u.department,
                total: u.vacationEntitlement + u.vacationCarryover,
                used: used,
                remaining: (u.vacationEntitlement + u.vacationCarryover) - used
            };
        });

        return <AdminView 
            allRequests={allRequests} 
            blockedDays={blockedDays} 
            usersStats={usersStats} 
        />;
    }

    // --- LOGIKA ZA OBIČNOG RADNIKA ---
    const myRequestsRaw = await prisma.vacationRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
    });

    const myRequests = myRequestsRaw.map(req => ({
        id: req.id,
        start: req.start,
        end: req.end,
        days: req.days,
        status: req.status
    }));

    // Sigurna serijalizacija user objekta (uklanja Date objekte koji prave warninge)
    const serializedUser = JSON.parse(JSON.stringify(user));

    return <UserView 
        userData={serializedUser} 
        myRequests={myRequests} 
        blockedDays={blockedDays} 
    />;
}