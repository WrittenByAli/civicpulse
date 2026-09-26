"""
Idempotent seed script — inserts 35 realistic Urdu-influenced English complaints.

Run from repo root:
    cd backend && python ../scripts/seed.py

Or inside Docker Compose:
    docker compose exec backend python ../scripts/seed.py

Idempotency: checks complaint count before inserting; skips if already seeded.
"""
import asyncio
import os
import sys

# Allow running from repo root or backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base, Complaint

SEED_COMPLAINTS = [
    # ── Water (8 complaints) ─────────────────────────────────────────────────
    {
        "text": (
            "Pani ka pipe burst ho gaya hai near Gulberg chowk. Sari gali mein "
            "pani bhar gaya hai and people cannot walk. Please fix urgently."
        ),
        "location": "Gulberg III, Lahore",
        "reporter_contact": "ali.hassan@gmail.com",
        "category": "water",
        "priority": "high",
        "status": "in_progress",
        "ai_summary": "Water pipe burst near Gulberg chowk causing flooding in the street.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Water supply band hai since 3 days in our block. Ghar mein pani "
            "nahi aa raha. Bachay school nahi ja sakte. Koi sun'ta nahi."
        ),
        "location": "Model Town, Lahore",
        "reporter_contact": "fatima.malik@hotmail.com",
        "category": "water",
        "priority": "high",
        "status": "open",
        "ai_summary": "No water supply for 3 days in Model Town block.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Sewage pipe leak ho rahi hai outside our house. Bahut bura smell "
            "aa raha hai and mosquitoes breed ho rahe hain. Dengue ka khatra hai."
        ),
        "location": "Johar Town, Lahore",
        "reporter_contact": None,
        "category": "water",
        "priority": "high",
        "status": "open",
        "ai_summary": "Sewage pipe leaking causing bad odour and dengue risk.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Water meter broken hai since last month. Bill aa raha hai but meter "
            "reading nahi ho rahi. Please send someone to check."
        ),
        "location": "DHA Phase 5, Lahore",
        "reporter_contact": "usman.ch@yahoo.com",
        "category": "water",
        "priority": "normal",
        "status": "resolved",
        "ai_summary": "Water meter broken, bill being generated without reading.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Main water line mein leakage hai on main boulevard. Road par "
            "paani aa raha hai aur traffic jam ho rahi hai."
        ),
        "location": "Bahria Town, Rawalpindi",
        "reporter_contact": None,
        "category": "water",
        "priority": "normal",
        "status": "open",
        "ai_summary": "Main water line leaking on boulevard causing traffic jam.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Underground drain choke ho gaya hai. Barish mein ghar ke andar "
            "paani aa jata hai. Please unclog karo before next rain."
        ),
        "location": "Gulshan-e-Iqbal, Karachi",
        "reporter_contact": "khalid.mehmood@gmail.com",
        "category": "water",
        "priority": "normal",
        "status": "in_progress",
        "ai_summary": "Underground drain blocked, rainwater flooding homes.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Water pressure bohot kam hai in our area. Tanki mein paani "
            "nahi bharta properly. Upstairs taps mein trickle aata hai."
        ),
        "location": "Clifton, Karachi",
        "reporter_contact": "sara.baig@gmail.com",
        "category": "water",
        "priority": "low",
        "status": "open",
        "ai_summary": "Low water pressure affecting upper floors in the area.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Nali ka paani road par aa raha hai near the park. Bachay khelne "
            "nahi ja sakte. Smell bhi bahut buri hai."
        ),
        "location": "Faisal Town, Lahore",
        "reporter_contact": None,
        "category": "water",
        "priority": "low",
        "status": "rejected",
        "ai_summary": "Drain water overflowing onto road near the park.",
        "triaged_by": "simulated",
    },
    # ── Electricity (7 complaints) ───────────────────────────────────────────
    {
        "text": (
            "Bijli nahi hai since morning. Load shedding schedule se zyada "
            "ghante ho rahe hain. Ghar mein patient hai. AC nahi chalta. "
            "Please restore immediately."
        ),
        "location": "Iqbal Town, Lahore",
        "reporter_contact": "dr.ahmed@live.com",
        "category": "electricity",
        "priority": "high",
        "status": "in_progress",
        "ai_summary": "Extended unscheduled power outage, medical patient at home.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Transformer jal gaya hai in our street. Poora block without "
            "electricity hai since 2 din. LESCO helpline nahi uthata."
        ),
        "location": "Samanabad, Lahore",
        "reporter_contact": "nasir.ali@gmail.com",
        "category": "electricity",
        "priority": "high",
        "status": "open",
        "ai_summary": "Street transformer burnt, entire block without power for 2 days.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Bijli ka khamba gir gaya hai road pe after last night storm. "
            "Wires dangling on the road — very dangerous for traffic."
        ),
        "location": "Garden Town, Lahore",
        "reporter_contact": None,
        "category": "electricity",
        "priority": "high",
        "status": "resolved",
        "ai_summary": "Electric pole fallen on road with dangling wires, safety hazard.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Voltage fluctuation bahut zyada ho rahi hai. Hamare ghar ka "
            "fridge aur washing machine kharab ho gaye hain. WAPDA zimmedaar hai."
        ),
        "location": "Township, Lahore",
        "reporter_contact": "amjad.raza@gmail.com",
        "category": "electricity",
        "priority": "normal",
        "status": "open",
        "ai_summary": "Severe voltage fluctuation damaging household appliances.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Meter reading galat aa rahi hai. Bill teen guna zyada hai last "
            "month se compare karke. Please meter check karwao."
        ),
        "location": "Gulberg II, Lahore",
        "reporter_contact": "business.owner@gmail.com",
        "category": "electricity",
        "priority": "normal",
        "status": "in_progress",
        "ai_summary": "Electricity bill tripled, meter reading suspected to be wrong.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Street light wiring exposed hai near the children school gate. "
            "Barsaat mein shock lagne ka khatra hai to kids."
        ),
        "location": "North Nazimabad, Karachi",
        "reporter_contact": "school.principal@edu.pk",
        "category": "electricity",
        "priority": "normal",
        "status": "open",
        "ai_summary": "Exposed electrical wiring near school gate posing shock risk.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Our area mein load shedding 12 ghante ho rahi hai daily. "
            "Schedule ke mutabiq sirf 8 ghante honi chahiye. Please investigate."
        ),
        "location": "Saddar, Karachi",
        "reporter_contact": None,
        "category": "electricity",
        "priority": "low",
        "status": "open",
        "ai_summary": "Load shedding exceeds scheduled hours by 4 hours daily.",
        "triaged_by": "simulated",
    },
    # ── Sanitation (6 complaints) ────────────────────────────────────────────
    {
        "text": (
            "Kachra collect nahi kiya gaya since 10 din. Gali mein garbage "
            "pile ho gai hai. Smell aur flies bahut zyada hain. Dengue risk hai."
        ),
        "location": "Orangi Town, Karachi",
        "reporter_contact": "community.rep@gmail.com",
        "category": "sanitation",
        "priority": "high",
        "status": "open",
        "ai_summary": "Garbage not collected for 10 days, dengue breeding risk.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Public dustbin near our market overflow ho gaya hai. Shopkeepers "
            "ko smell ki wajah se business affected ho raha hai."
        ),
        "location": "Anarkali Bazaar, Lahore",
        "reporter_contact": "anarkali.traders@gmail.com",
        "category": "sanitation",
        "priority": "normal",
        "status": "resolved",
        "ai_summary": "Overflowing public dustbin near market affecting local businesses.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Stray dogs bahut zyada ho gaye hain in our locality. Do bacche "
            "bite ho chuke hain. Municipality ko action lena chahiye."
        ),
        "location": "Lyari, Karachi",
        "reporter_contact": None,
        "category": "sanitation",
        "priority": "normal",
        "status": "in_progress",
        "ai_summary": "Stray dog menace causing bites to children in locality.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Waste collection truck sirf main road pe aata hai. Galiyon mein "
            "nahi jata. Residents ko khud main road pe kachra phenk'na parta hai."
        ),
        "location": "Korangi, Karachi",
        "reporter_contact": "korangi.resident@gmail.com",
        "category": "sanitation",
        "priority": "normal",
        "status": "open",
        "ai_summary": "Waste collection truck skipping side streets.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Public park mein kachra bahut phela hua hai. Families "
            "ane se katraati hain. Sweepers nahi aate weekend pe."
        ),
        "location": "Jinnah Park, Rawalpindi",
        "reporter_contact": None,
        "category": "sanitation",
        "priority": "low",
        "status": "open",
        "ai_summary": "Public park littered with garbage, sweepers absent on weekends.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Construction waste dumped illegally on empty plot near houses. "
            "Residents complaining since months. No action taken yet."
        ),
        "location": "DHA Phase 6, Lahore",
        "reporter_contact": "dha.resident@yahoo.com",
        "category": "sanitation",
        "priority": "low",
        "status": "rejected",
        "ai_summary": "Illegal construction waste dumped on empty residential plot.",
        "triaged_by": "simulated",
    },
    # ── Roads (7 complaints) ─────────────────────────────────────────────────
    {
        "text": (
            "Road mein bohot bara pothole hai near the bridge. Kal ek "
            "motorcycle accident hua. Driver badly injured. Emergency repair chahiye."
        ),
        "location": "McLeod Road, Lahore",
        "reporter_contact": "traffic.warden@punjab.gov.pk",
        "category": "roads",
        "priority": "high",
        "status": "in_progress",
        "ai_summary": "Large pothole near bridge caused motorcycle accident with injuries.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Main road completely damaged hai after heavy rain. "
            "Gaadi nahi nikal sakti. School bus bhi nahi aa rahi. "
            "Please repair urgently."
        ),
        "location": "Gulshan-e-Ravi, Lahore",
        "reporter_contact": None,
        "category": "roads",
        "priority": "high",
        "status": "open",
        "ai_summary": "Main road completely damaged after rain, school bus cannot pass.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Road divider toot gaya hai aur traffic ek doosre ki taraf aa "
            "rahi hai. Accident ka khatra hai on this stretch."
        ),
        "location": "Jail Road, Lahore",
        "reporter_contact": "concerned.driver@gmail.com",
        "category": "roads",
        "priority": "normal",
        "status": "open",
        "ai_summary": "Road divider broken causing dangerous oncoming traffic.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Speed breaker paint completely faded hai. Raat ko dikh nahi "
            "raha. Kaafi log accidentally speed breaker hit kar rahe hain."
        ),
        "location": "Cavalry Ground, Lahore",
        "reporter_contact": None,
        "category": "roads",
        "priority": "normal",
        "status": "resolved",
        "ai_summary": "Speed breaker paint faded, invisible at night causing accidents.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Road side pavement broken hai near bus stop. Old people "
            "aur women ko chalne mein bahut mushkil hoti hai."
        ),
        "location": "Saddar, Lahore",
        "reporter_contact": "elderly.resident@gmail.com",
        "category": "roads",
        "priority": "normal",
        "status": "open",
        "ai_summary": "Broken pavement near bus stop hazardous for elderly pedestrians.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Road markings aur signs faded hain at the intersection. "
            "Visitors aur new drivers ko direction nahi milti."
        ),
        "location": "Clifton, Karachi",
        "reporter_contact": None,
        "category": "roads",
        "priority": "low",
        "status": "open",
        "ai_summary": "Faded road markings at intersection causing navigation issues.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Gali mein road repair ka kaam adha chor diya gaya hai. "
            "Contractor chala gaya. Road worse ho gayi pehle se."
        ),
        "location": "Wapda Town, Lahore",
        "reporter_contact": "wapda.resident@gmail.com",
        "category": "roads",
        "priority": "low",
        "status": "open",
        "ai_summary": "Road repair work abandoned halfway, road worse than before.",
        "triaged_by": "simulated",
    },
    # ── Streetlights (4 complaints) ──────────────────────────────────────────
    {
        "text": (
            "Street lights poori gali mein band hain since 2 weeks. "
            "Raat ko chor waqiyat ho chuki hain. Residents dar rahe hain. "
            "Please restore immediately."
        ),
        "location": "Muslim Town, Lahore",
        "reporter_contact": "security.guard@gmail.com",
        "category": "streetlights",
        "priority": "high",
        "status": "in_progress",
        "ai_summary": "All streetlights off for 2 weeks, theft incidents increasing.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Street light poles ki wiring khuli pari hai. Bachay "
            "pole se khelte hain. Shock lagne ka serious danger hai."
        ),
        "location": "Allama Iqbal Town, Lahore",
        "reporter_contact": None,
        "category": "streetlights",
        "priority": "high",
        "status": "open",
        "ai_summary": "Exposed wiring on streetlight poles, children at risk of shock.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "3 lamp posts bulbs fused hain near the hospital. "
            "Ambulances ko raat ko mushkil hoti hai driveway dhundne mein."
        ),
        "location": "Services Hospital, Lahore",
        "reporter_contact": "hospital.admin@services.gov.pk",
        "category": "streetlights",
        "priority": "normal",
        "status": "resolved",
        "ai_summary": "Fused streetlights near hospital affecting ambulance access.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Park ki lights subah tak jalti rehti hain. Unnecessary "
            "bijli waste ho rahi hai. Timer kharab lagta hai."
        ),
        "location": "Gulberg V, Lahore",
        "reporter_contact": "environment.concern@gmail.com",
        "category": "streetlights",
        "priority": "low",
        "status": "open",
        "ai_summary": "Park lights stay on until morning, timer appears to be broken.",
        "triaged_by": "simulated",
    },
    # ── Other (3 complaints) ─────────────────────────────────────────────────
    {
        "text": (
            "Nala / open drain near our school has no boundary wall or fence. "
            "Last week ek bacha gir gaya. Koi serious accident hone se pehle "
            "fencing lagao please."
        ),
        "location": "Kotwali, Lahore",
        "reporter_contact": "school.teacher@gmail.com",
        "category": "other",
        "priority": "high",
        "status": "open",
        "ai_summary": "Unfenced open drain near school, child fell in last week.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Illegal encroachment on public footpath near our market. "
            "Vendors ne poori sidewalk cover kar li hai. Pedestrians "
            "road pe chalne par majboor hain."
        ),
        "location": "Urdu Bazaar, Lahore",
        "reporter_contact": None,
        "category": "other",
        "priority": "normal",
        "status": "in_progress",
        "ai_summary": "Vendors encroaching public footpath forcing pedestrians onto road.",
        "triaged_by": "simulated",
    },
    {
        "text": (
            "Manhole cover missing hai on main road. Raat ko koi "
            "bhi gir sakta hai. Please cover immediately before any accident."
        ),
        "location": "MA Jinnah Road, Karachi",
        "reporter_contact": "concerned.citizen@gmail.com",
        "category": "other",
        "priority": "normal",
        "status": "resolved",
        "ai_summary": "Missing manhole cover on main road posing fall hazard at night.",
        "triaged_by": "simulated",
    },
]


async def seed(database_url: str) -> None:
    engine = create_async_engine(database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        count_result = await session.execute(select(func.count()).select_from(Complaint))
        existing = count_result.scalar_one()

        if existing >= len(SEED_COMPLAINTS):
            print(
                f"Database already has {existing} complaints "
                f"(>= {len(SEED_COMPLAINTS)}). Skipping seed."
            )
            await engine.dispose()
            return

        print(f"Seeding {len(SEED_COMPLAINTS)} complaints...")

        for data in SEED_COMPLAINTS:
            complaint = Complaint(
                text=data["text"],
                location=data["location"],
                reporter_contact=data.get("reporter_contact"),
                category=data["category"],
                priority=data["priority"],
                status=data["status"],
                ai_summary=data["ai_summary"],
                triaged_by=data["triaged_by"],
                triage_latency_ms=12,
            )
            session.add(complaint)

        await session.commit()
        print(f"Done — {len(SEED_COMPLAINTS)} complaints inserted.")

    await engine.dispose()


if __name__ == "__main__":
    db_url = settings.DATABASE_URL
    if "sqlite" in db_url:
        print("WARNING: seeding into SQLite — use PostgreSQL for production.")
    asyncio.run(seed(db_url))
