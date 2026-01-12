import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import UserView from "./_components/UserView";
import AdminView from "./_components/AdminView";

export default async function VacationPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login");

    // FIX: Siguran pristup bez rušenja builda
    const sessionUserId = (session.user as { id: string }).id;

    const user = await prisma.user.findUnique({
        where: { id: sessionUserId },
        include: {
            restaurants: { include: { restaurant: true } }
        }
    });

    if (!user) return <div>Greška: Korisnik nije nađen.</div>;

    // FIX: Ispravno poređenje Role enuma
    const isGodMode = user.role === Role.SYSTEM_ARCHITECT || user.role === Role.SUPER_ADMIN;
    const isManager = user.role === Role.ADMIN || user.role === Role.MANAGER;

    // Dohvati praznike
    const blockedDaysRaw = await prisma.blockedDay.findMany({
        orderBy: { date: 'asc' }
    });
    
    // Konverzija u običan objekat za props
    const blockedDays = blockedDaysRaw.map(d => ({
        id: d.id,
        date: d.date,
        reason: d.reason
    }));

    // --- ADMIN/MANAGER POGLED ---
    if (isGodMode || isManager) {
        
        let userWhereClause: any = {};
        let requestWhereClause: any = {};

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

        // FIX: Mapiranje podataka da odgovaraju Typescript interfejsu u AdminView
        const allRequests = allRequestsRaw.map(req => ({
            id: req.id,
            start: req.start,
            end: req.end,
            days: req.days,
            status: req.status,
            user: {
                name: req.user.name,
                email: req.user.email,
                mainRestaurant: req.user.restaurants[0]?.restaurant.name || 'N/A'
            }
        }));

        const allUsers = await prisma.user.findMany({
            where: userWhereClause,
            include: {
                vacations: { where: { status: 'APPROVED' } },
                restaurants: { include: { restaurant: true } }
            },
            orderBy: { name: 'asc' }
        });

        const usersStats = allUsers.map(u => {
            const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
            
            // FIX: Kreiramo niz imena restorana za prikaz u AdminView
            const restaurantNames = u.restaurants.map(r => r.restaurant.name || "N/A");
            
            return {
                id: u.id,
                name: u.name,
                restaurantNames: restaurantNames,
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

    // --- RADNIK POGLED ---
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

    // FIX: Serijalizacija User objekta
    const serializedUser = JSON.parse(JSON.stringify(user));

    return <UserView 
        userData={serializedUser} 
        myRequests={myRequests} 
        blockedDays={blockedDays} 
    />;
}