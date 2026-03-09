import { LayoutGrid, Search, GitCompare, CircleHelp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Value360Page() {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-56 bg-[#34495dff] text-white flex flex-col py-4">
        <div className="flex items-center gap-2 px-4 mb-6">
          <img
            src="/verisk-removebg.png"
            alt="Verisk / 360Value"
            className="h-8 w-auto object-contain"
          />
          <span className="text-sm font-semibold tracking-wide">360Value</span>
        </div>

        <nav className="space-y-1 text-sm">
          <button className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/10">
            <LayoutGrid className="h-4 w-4" />
            <span>Dashboard</span>
          </button>
          <button className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/10">
            <Search className="h-4 w-4" />
            <span>Search</span>
          </button>
          <button className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/10">
            <GitCompare className="h-4 w-4" />
            <span>Compare</span>
          </button>
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col bg-[#F9FAFB]">
        {/* Top header (Farmers-style) */}
        <header className="h-12 border-b border-[#E5E7EB] bg-white flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img
              src="/Farmers_Insurance_Group_logo.svg.png"
              alt="Farmers Insurance"
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-4 text-[#6B7280] text-sm">
            <button className="hover:text-[#111827]">+</button>
            <button className="hover:text-[#111827]">
              <Search className="h-4 w-4" />
            </button>
            <button className="h-6 w-6 rounded-full bg-[#E5E7EB]" />
          </div>
        </header>

        {/* Gray address strip between header and fields */}
        <div className="border-b border-[#E5E7EB] bg-[#F3F4F6] px-4 py-2 text-xs font-medium text-[#4B5563]">
          1 TO 4 FAMILY - 9808 COOLIDGE DR, MCKINNEY TX 75072
        </div>

        {/* Primary information fields */}
        <section className="flex-1 px-4 py-4">
          <div className="max-w-5xl bg-white border border-[#E5E7EB] rounded-md shadow-sm p-4">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#111827]">
                Primary Information (cont.)
              </h2>
            </div>
            <div className="space-y-3 text-[13px] text-[#374151]">
              <PrimaryField
                label="Use"
                value="Single Family Detached"
                options={["Single Family Detached", "Multi Family", "Condo/Townhouse"]}
              />
              <PrimaryField
                label="Style"
                value="Unknown"
                options={["Unknown", "Traditional", "Contemporary"]}
              />
              <PrimaryField
                label="Number of Stories"
                value="1 Story"
                options={["1 Story", "2 Story", "3+ Story"]}
              />
              <PrimaryField
                label="Foundation Type"
                value="Concrete Slab"
                options={["Concrete Slab", "Pier & Beam", "Crawl Space"]}
                withPercent
              />
              <PrimaryField
                label="Exterior Wall Finish"
                value="Brick Veneer"
                options={["Brick Veneer", "Stucco", "Vinyl Siding"]}
                withPercent
              />
              <PrimaryField
                label="Exterior Wall Construction"
                value="Wood Framing"
                options={["Wood Framing", "Steel Framing", "Masonry Block"]}
                withPercent
              />
              <PrimaryField
                label="Roof Cover"
                value="Composition - Architectural Shingle"
                options={[
                  "Composition - Architectural Shingle",
                  "Metal",
                  "Tile",
                ]}
                withPercent
              />
              <PrimaryField
                label="Garage/Carport"
                value="2 Car (397–576 sq ft)"
                options={[
                  "2 Car (397–576 sq ft)",
                  "1 Car (200–396 sq ft)",
                  "3 Car (577–800 sq ft)",
                ]}
              />
              <PrimaryField
                label="Style (Garage)"
                value="Attached / Built-In"
                options={["Attached / Built-In", "Detached", "Carport"]}
              />
              <FloorCoveringsField />
              <PrimaryField
                label="Fireplaces"
                value="None"
                options={["None", "1 Fireplace", "2 Fireplaces"]}
              />
              <PrimaryField
                label="Kitchen(s)"
                value="Medium (11'x10')"
                options={["Medium (11'x10')", "Small (8'x8')", "Large (14'x12')"]}
              />
              <PrimaryField
                label="Bathroom(s)"
                value="Half"
                options={["Half", "Full", "Full + Half"]}
              />
            </div>
          </div>
        </section>

        {/* Footer actions (sticky at bottom) */}
        <footer className="border-t border-[#E5E7EB] bg-white px-4 py-3 sticky bottom-0">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button className="px-4 py-2 text-sm font-medium text-white bg-[#1F7BB6] hover:bg-[#186596] rounded-sm">
              Back
            </button>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-white bg-[#1F7BB6] hover:bg-[#186596] rounded-sm">
                Enter more details
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-[#2E7D32] hover:bg-[#1B5E20] rounded-sm">
                Calculate now
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

type PrimaryFieldProps = {
  label: string;
  value: string;
  options: string[];
  withPercent?: boolean;
};

function PrimaryField({ label, value, options, withPercent = false }: PrimaryFieldProps) {
  return (
    <div className="grid grid-cols-[220px_260px_64px] items-start gap-x-2">
      <div className="flex items-start gap-1">
        <CircleHelp className="h-3.5 w-3.5 text-[#9CA3AF] mt-[2px]" />
        <span className="text-[11px] font-medium text-[#111827]">{label}</span>
      </div>
      <div className="w-full">
        <Select defaultValue={value}>
          <SelectTrigger className="h-8 w-full border-[#D1D5DB] bg-white text-xs text-[#111827]">
            <SelectValue placeholder={value} />
          </SelectTrigger>
          <SelectContent className="text-xs">
            {options.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-16">
        {withPercent && (
          <div className="flex items-center border border-[#D1D5DB] bg-white rounded-sm px-1 h-8">
            <input
              type="number"
              className="w-full bg-transparent text-right text-xs text-[#111827] outline-none"
              placeholder=""
            />
            <span className="ml-0.5 text-[10px] text-[#9CA3AF]">%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FloorCoveringsField() {
  const options = ["Carpet", "Tile - Ceramic", "Hardwood"];

  return (
    <div className="grid grid-cols-[220px_260px_64px] items-start gap-x-2">
      <div className="flex items-start gap-1">
        <CircleHelp className="h-3.5 w-3.5 text-[#9CA3AF] mt-[2px]" />
        <span className="text-[11px] font-medium text-[#111827]">Floor Coverings</span>
      </div>
      <div className="w-full space-y-2">
        {[0, 1].map((index) => (
          <div key={index} className="flex items-center gap-2">
            <Select defaultValue={index === 0 ? "Carpet" : "Tile - Ceramic"}>
              <SelectTrigger className="h-8 w-full border-[#D1D5DB] bg-white text-xs text-[#111827]">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {options.map((option) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="w-16 space-y-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="flex items-center border border-[#D1D5DB] bg-white rounded-sm px-1 h-8"
          >
            <input
              type="number"
              className="w-full bg-transparent text-right text-xs text-[#111827] outline-none"
              placeholder=""
            />
            <span className="ml-0.5 text-[10px] text-[#9CA3AF]">%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

