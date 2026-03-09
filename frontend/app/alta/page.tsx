export default function AltaPage() {
  return (
    <div className="min-h-screen bg-[#F3F6FB] flex px-4 py-6 md:px-8">
      {/* Sidebar */}
      <aside className="w-64 max-w-xs bg-white border-r border-[#E5E7EB] p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <img
            src="/alta%20logo.png"
            alt="Alta Experience"
            className="h-14 w-auto object-contain"
          />
        </div>
        <div className="text-xs text-[#4B5563] font-medium">
          <p>Elie Naboushsi - Home</p>
          <p className="text-[11px] text-[#6B7280] mt-1">Alta # 177281581481464040</p>
        </div>
        <nav className="mt-3 flex-1 text-sm text-[#374151]">
          <ul className="space-y-0.5">
            <li className="px-2 py-1">
              <span className="inline-flex items-center gap-1 font-medium text-[#111827]">
                <span className="text-[#1D4ED8] text-sm leading-none">✓</span>
                Customer info
              </span>
            </li>
            <li className="px-2 py-1 bg-[#E5F0FF] text-[#1D4ED8] font-medium">
              Home features
            </li>
            <li className="px-4 py-1 text-[#4B5563]">
              •{" "}
              <a href="/alta/est-replacement-cost" className="hover:underline">
                Est replacement cost
              </a>
            </li>
            <li className="px-4 py-1 text-[#4B5563]">• Home coverages</li>
            <li className="px-4 py-1 text-[#4B5563]">• Home bind</li>
          </ul>

          <hr className="my-3 border-[#E5E7EB]" />

          <ul className="space-y-0.5">
            <li className="px-2 py-1 text-[#4B5563]">Rates summary</li>
            <li className="px-2 py-1 text-[#4B5563]">Compare rates</li>
            <li className="px-2 py-1 text-[#4B5563]">Create presentation</li>
          </ul>

          <hr className="my-3 border-[#E5E7EB]" />

          <ul className="space-y-0.5">
            <li className="px-2 py-1 text-[#4B5563]">Credit hit</li>
          </ul>

          <hr className="my-3 border-[#E5E7EB]" />

          <ul className="space-y-0.5">
            <li className="px-2 py-1 text-[#111827] font-semibold">Home reports</li>
            <li className="px-2 py-1 text-[#9CA3AF]">
              Contingencies <span className="text-[11px]">(Not available yet)</span>
            </li>
          </ul>
        </nav>

        <div className="mt-3 pt-3 border-t border-[#E5E7EB] text-xs text-[#4B5563]">
          <p>Mike Ridley - 355130</p>
          <p>
            Commission series - A <span className="text-[#2563EB]">Edit</span>
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-4 md:ml-6">
        <div className="bg-[#e6eff8ff] border border-[#E2E8F0] p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Home features
              </p>
            </div>
            <div className="text-right text-xs text-[#6B7280] space-y-1">
              <a
                href="/360Value"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-[#1D4ED8] border border-[#BFDBFE] shadow-sm"
              >
                Open 360Value
              </a>
              <div>
                <div>360Value ID: A8E2-QA25</div>
                <div>360Value ID Version: A8E2-QA25.3</div>
              </div>
            </div>
          </div>

          {/* Safety features */}
          <section className="space-y-3 text-[13px] text-[#374151]">
            <h2 className="text-sm font-semibold text-[#111827]">
              Safety features
            </h2>
            <div className="space-y-2">
              <Field label="Fire alarm" value="No device" />
              <Field label="Burglar alarm" value="No device" />
              <Field label="Water leak protection device" value="No device" />
              <Field label="FORTIFIED Home certification" value="Not certified" />
              <Field label="Permanent storm shutters" value="No" />
            </div>
          </section>

          <hr className="border-[#E5E7EB]" />

          {/* Home details */}
          <section className="space-y-3 text-[13px] text-[#374151]">
            <h2 className="text-sm font-semibold text-[#111827]">
              Home details
            </h2>
            <div className="space-y-2">
              <Field label="What year was the home built?" value="2003" />
              <Field label="What is the livable square feet of the home?" value="1,914" />
              <RadioRow
                label="Is all the plumbing PVC, PEX or copper in the home?"
                yes
              />
              <RadioRow
                label="Are there solar panels present?"
                yes={false}
              />
            </div>
          </section>

          <hr className="border-[#E5E7EB]" />

          {/* Roofing */}
          <section className="space-y-3 text-[13px] text-[#374151]">
            <h2 className="text-sm font-semibold text-[#111827]">
              Roofing
            </h2>
            <div className="space-y-2">
              <Field label="Roof materials" value="Composition - Architectural shingle" />
              <Field label="Roofing style" value="Hip" />
              <RadioRow
                label="When was the roof fully replaced most recently?"
                note="Replacement year"
                value="2017"
              />
            </div>
          </section>

          <hr className="border-[#E5E7EB]" />

          {/* Unusual risks */}
          <section className="space-y-3 text-[13px] text-[#374151]">
            <h2 className="text-sm font-semibold text-[#111827]">
              Unusual risks
            </h2>
            <div className="space-y-2">
              <RadioRow
                label="Is the property under construction or major renovation?"
                yes={false}
              />
            </div>
          </section>

          {/* Footer actions */}
          <div className="flex justify-start gap-3 items-center pt-4 border-t border-[#E5E7EB]">
            <button className="px-4 py-2 text-sm text-[#1F2937] border border-[#D1D5DB] rounded-md bg-white hover:bg-[#F3F4F6]">
              Back
            </button>
            <button className="px-5 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-md">
              Continue
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
};

function Field({ label, value }: FieldProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_180px] items-center gap-x-4 pl-4">
      <div className="text-[11px] font-semibold text-[#111827]">{label}</div>
      <div className="border border-[#D1D5DB] bg-[#F9FAFB] px-2 py-1 text-right text-xs justify-self-end w-full">
        {value}
      </div>
    </div>
  );
}

type RadioRowProps = {
  label: string;
  yes?: boolean;
  note?: string;
  value?: string;
};

function RadioRow({ label, yes = true, note, value }: RadioRowProps) {
  return (
    <div className="space-y-1 pl-4">
      <div className="grid grid-cols-[minmax(0,1fr)_180px] items-center gap-x-4">
        <div className="text-[11px] font-semibold text-[#111827]">{label}</div>
        <div className="flex items-center gap-4 text-xs text-[#374151] justify-self-end">
          <span className="flex items-center gap-1">
            <span
              className={`inline-flex h-3 w-3 rounded-full border border-[#9CA3AF] ${
                yes ? "bg-[#1D4ED8]" : "bg-white"
              }`}
            />
            Yes
          </span>
          <span className="flex items-center gap-1">
            <span
              className={`inline-flex h-3 w-3 rounded-full border border-[#9CA3AF] ${
                !yes ? "bg-[#1D4ED8]" : "bg-white"
              }`}
            />
            No
          </span>
        </div>
      </div>
      {note && (
        <div className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-x-4 mt-0.5">
          <div className="text-[11px] font-semibold text-[#111827]">{note}</div>
          {value && (
            <div className="border border-[#D1D5DB] bg-[#F9FAFB] px-2 py-1 text-right text-xs justify-self-end w-full">
              {value}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

