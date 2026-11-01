import { GROOMING_PROFILES, isPerPetAllocation, type GroomingAllocation, type GroomingStageAllocation } from "@/lib/grooming-allocation";
import { formatBaht } from "@/lib/format";

export function GroomingWorkSummary({ allocation, pets, staff }: {
  allocation: GroomingAllocation; pets: Array<{ id: string; name: string }>; staff: Array<{ id: string; name: string }>;
}) {
  const name = (id: string) => staff.find((person) => person.id === id)?.name ?? "พนักงานเดิม";
  function stages(value: GroomingStageAllocation) {
    return GROOMING_PROFILES[value.profile].map((stage) => <div className="grooming-summary-row" key={stage.key}>
      <span>{stage.label}</span><strong>{value.stages[stage.key].map(name).join(" และ ")}{value.stages[stage.key].length === 2 ? " · ทำร่วมกัน" : ""}</strong>
    </div>);
  }
  return <div className="stack"><strong>ผู้ทำแต่ละขั้นตอน</strong>
    {isPerPetAllocation(allocation) ? allocation.pets.map((pet) => <section className="grooming-pet-panel stack" key={pet.petId}>
      <div className="grooming-pet-heading"><strong>{pets.find((entry) => entry.id === pet.petId)?.name ?? "สัตว์เลี้ยง"}</strong><strong>{formatBaht(pet.amount)}</strong></div>
      {pet.allocation ? stages(pet.allocation) : <div className="grooming-summary-row"><span>บริการทั้งงาน</span><strong>{[pet.performedById, pet.secondaryPerformedById].filter((id): id is string => Boolean(id)).map(name).join(" และ ")}</strong></div>}
    </section>) : stages(allocation)}
  </div>;
}
