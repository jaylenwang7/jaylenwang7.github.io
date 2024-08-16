import os
import re
import yaml
import bibtexparser
from bibtexparser.customization import convert_to_unicode

def format_authors(authors):
    author_list = authors.split(' and ')
    formatted_authors = []
    for author in author_list:
        names = author.split(', ')
        if len(names) > 1:
            # Last name, First name format
            formatted_authors.append(f"{names[1][0]}. {names[0]}")
        else:
            # First name Last name format
            names = author.split()
            formatted_authors.append(f"{names[0][0]}. {names[-1]}")
    # Add 'and' before the last author
    if len(formatted_authors) > 1:
        formatted_authors[-1] = 'and ' + formatted_authors[-1]
    return ', '.join(formatted_authors)

def format_citation(entry):
    authors = format_authors(entry.get('author', ''))
    title = entry.get('title', '').strip('{}')
    booktitle = entry.get('booktitle', '')
    year = entry.get('year', '')
    
    return f"{authors}, \"{title},\" in <i>{booktitle}</i>, {year}."

def process_file(filepath):
    with open(filepath, 'r') as file:
        content = file.read()

    # Split front matter and body
    parts = re.split(r'^---\s*$', content, 2, re.MULTILINE)
    if len(parts) < 3:
        print(f"Skipping {filepath}: No front matter found")
        return

    front_matter = yaml.safe_load(parts[1])
    body = parts[2]

    if 'bibtex' in front_matter:
        bibtex_str = front_matter['bibtex']
        bib_database = bibtexparser.loads(bibtex_str, parser=bibtexparser.bparser.BibTexParser())
        bib_database.customization = convert_to_unicode
        
        if bib_database.entries:
            entry = bib_database.entries[0]
            formatted_citation = format_citation(entry)
            front_matter['citation'] = formatted_citation

    # Reconstruct the file content
    new_content = "---\n" + yaml.dump(front_matter, allow_unicode=True) + "---" + body

    with open(filepath, 'w') as file:
        file.write(new_content)

def main():
    publications_dir = '_publications'
    for filename in os.listdir(publications_dir):
        if filename.endswith('.md'):
            filepath = os.path.join(publications_dir, filename)
            print(f"Processing {filepath}")
            process_file(filepath)

if __name__ == "__main__":
    main()