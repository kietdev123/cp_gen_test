function RawInline(element)
  if element.format == "html" and element.text:lower():match("^%s*<br%s*/?>%s*$") then
    return pandoc.LineBreak()
  end
end
