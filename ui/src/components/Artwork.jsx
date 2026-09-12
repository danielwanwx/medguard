export function BottleArtwork({ className = "" }) {
  return (
    <svg className={`mg-artwork ${className}`.trim()} viewBox="0 0 320 244" fill="none" aria-hidden="true">
      <path d="M38 190C83 159 108 194 144 173C178 153 192 111 238 124C275 134 278 174 303 166" stroke="#DCE8B0" strokeWidth="21" strokeLinecap="round" />
      <path d="M28 209C90 187 137 215 185 196C236 175 253 200 294 187" stroke="#F0D4BF" strokeWidth="9" strokeLinecap="round" />
      <rect x="113" y="33" width="92" height="31" rx="12" fill="#214C3D" />
      <rect x="125" y="17" width="68" height="28" rx="11" fill="#315D4E" />
      <path d="M109 62H209L218 196C219 207 210 217 198 217H120C108 217 100 207 101 196L109 62Z" fill="#FFFDF7" stroke="#214C3D" strokeWidth="5" />
      <rect x="112" y="96" width="94" height="68" rx="12" fill="#DCE8B0" />
      <path d="M139 130C147 120 159 119 168 130C177 141 190 140 193 128" stroke="#214C3D" strokeWidth="7" strokeLinecap="round" />
      <circle cx="130" cy="82" r="5" fill="#F0D4BF" />
      <circle cx="196" cy="82" r="5" fill="#F0D4BF" />
    </svg>
  );
}

export function CabinetArtwork({ className = "" }) {
  return (
    <svg className={`mg-artwork ${className}`.trim()} viewBox="0 0 320 215" fill="none" aria-hidden="true">
      <rect x="44" y="35" width="232" height="149" rx="25" fill="#FFFDF7" stroke="#214C3D" strokeWidth="5" />
      <path d="M60 116H260" stroke="#214C3D" strokeWidth="5" />
      <path d="M83 36V116" stroke="#214C3D" strokeWidth="5" />
      <rect x="105" y="73" width="37" height="43" rx="10" fill="#F0D4BF" />
      <rect x="112" y="56" width="23" height="23" rx="8" fill="#214C3D" />
      <rect x="169" y="68" width="50" height="48" rx="12" fill="#DCE8B0" />
      <path d="M182 69V57C182 51 187 46 194 46C201 46 206 51 206 57V69" stroke="#214C3D" strokeWidth="5" />
      <rect x="94" y="135" width="40" height="49" rx="10" fill="#DCE8B0" />
      <rect x="101" y="122" width="26" height="18" rx="6" fill="#214C3D" />
      <rect x="179" y="139" width="58" height="45" rx="12" fill="#F0D4BF" />
      <path d="M199 152C207 143 219 147 220 158" stroke="#214C3D" strokeWidth="5" strokeLinecap="round" />
      <circle cx="270" cy="44" r="14" fill="#DCE8B0" />
      <circle cx="52" cy="168" r="10" fill="#F0D4BF" />
    </svg>
  );
}
