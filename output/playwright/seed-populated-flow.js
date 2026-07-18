await page.evaluate(async () => {
  const { db } = await import('/src/db/database.ts')
  await db.delete()
  await db.open()

  const now = Date.now()
  await db.subjects.bulkAdd([
    { id: 1, name: 'Biology', normalizedName: 'biology', description: 'Cell biology, genetics, and living systems', createdAt: now - 5000, updatedAt: now - 5000 },
    { id: 2, name: 'World History', normalizedName: 'world history', description: 'Ancient civilizations through modern history', createdAt: now - 4000, updatedAt: now - 4000 }
  ])

  await db.topics.bulkAdd([
    { id: 1, subjectId: 1, name: 'Cell Biology', normalizedName: 'cell biology', createdAt: now - 3000 },
    { id: 2, subjectId: 1, name: 'Genetics', normalizedName: 'genetics', createdAt: now - 3000 },
    { id: 3, subjectId: 2, name: 'Ancient Civilizations', normalizedName: 'ancient civilizations', createdAt: now - 2000 },
    { id: 4, subjectId: 2, name: 'Modern History', normalizedName: 'modern history', createdAt: now - 2000 }
  ])

  const biology = [
    ['What is the smallest structural and functional unit of life?', ['Cell', 'Tissue', 'Organ', 'Organism'], 'Cells perform the fundamental processes required for life.'],
    ['Which organelle produces most cellular ATP?', ['Mitochondrion', 'Nucleus', 'Golgi apparatus', 'Lysosome'], 'Mitochondria generate ATP through cellular respiration.'],
    ['What controls movement into and out of a cell?', ['Cell membrane', 'Cell wall', 'Cytoplasm', 'Ribosome'], 'The selectively permeable cell membrane regulates transport.'],
    ['Where is DNA stored in a eukaryotic cell?', ['Nucleus', 'Vacuole', 'Cell wall', 'Centriole'], 'Most eukaryotic DNA is packaged inside the nucleus.'],
    ['Which structure assembles proteins?', ['Ribosome', 'Lysosome', 'Chloroplast', 'Vesicle'], 'Ribosomes translate messenger RNA into proteins.'],
    ['What is the movement of water across a membrane called?', ['Osmosis', 'Respiration', 'Transcription', 'Digestion'], 'Osmosis is passive movement of water across a selectively permeable membrane.'],
    ['Which phase duplicates DNA before cell division?', ['S phase', 'G1 phase', 'M phase', 'Cytokinesis'], 'DNA replication occurs during the synthesis phase.'],
    ['What molecule carries genetic instructions from DNA?', ['Messenger RNA', 'Glucose', 'ATP synthase', 'Phospholipid'], 'Messenger RNA carries a transcribed coding sequence to ribosomes.'],
    ['Which term describes two identical gene variants?', ['Homozygous', 'Heterozygous', 'Polygenic', 'Recessive'], 'Homozygous means both alleles at a locus are the same.'],
    ['What is an observable inherited characteristic called?', ['Phenotype', 'Genotype', 'Chromosome', 'Mutation'], 'Phenotype is the observable expression of genetic and environmental influences.'],
    ['Which process makes gametes with half the chromosome number?', ['Meiosis', 'Mitosis', 'Binary fission', 'Budding'], 'Meiosis produces haploid gametes from diploid precursor cells.'],
    ['What is a permanent change in a DNA sequence?', ['Mutation', 'Translation', 'Diffusion', 'Replication'], 'A mutation is an alteration in the nucleotide sequence.'],
    ['Which base pairs with adenine in DNA?', ['Thymine', 'Cytosine', 'Guanine', 'Uracil'], 'In DNA, adenine forms complementary hydrogen bonds with thymine.'],
    ['Which inheritance pattern blends neither parental allele?', ['Codominance', 'Complete dominance', 'Sex linkage', 'Polyploidy'], 'In codominance both alleles are distinctly expressed.'],
    ['What does a Punnett square predict?', ['Possible offspring genotypes', 'Exact mutation dates', 'Protein folding', 'Population size'], 'Punnett squares model expected allele combinations in offspring.'],
    ['Which enzyme separates DNA strands during replication?', ['Helicase', 'Amylase', 'Ligase only', 'Pepsin'], 'Helicase unwinds the double helix at the replication fork.']
  ]

  const history = [
    ['Which river supported ancient Egyptian civilization?', ['Nile', 'Tigris', 'Indus', 'Yellow River'], 'The Nile supplied water, transport, and fertile floodplain soil.'],
    ['Which city was central to the Roman Empire?', ['Rome', 'Sparta', 'Babylon', 'Memphis'], 'Rome was the political center of the Roman Empire.'],
    ['What invention accelerated the spread of books in Europe?', ['Printing press', 'Steam engine', 'Compass', 'Telegraph'], 'Movable-type printing made books faster and cheaper to reproduce.'],
    ['Which event began in 1789?', ['French Revolution', 'Industrial Revolution', 'American Civil War', 'Renaissance'], 'The French Revolution began in 1789.'],
    ['Which alliance opposed the Central Powers in World War I?', ['Allied Powers', 'Axis Powers', 'Warsaw Pact', 'Triple League'], 'The Allied Powers fought against the Central Powers.'],
    ['What organization was founded after World War II to support international cooperation?', ['United Nations', 'League of Delos', 'NATO only', 'European Coal Board'], 'The United Nations was established in 1945.']
  ]

  const questions = []
  biology.forEach((entry, index) => questions.push({
    id: index + 1,
    subjectId: 1,
    topicId: index < 8 ? 1 : 2,
    questionText: entry[0],
    options: entry[1],
    correctOptionIndex: 0,
    explanation: entry[2],
    difficulty: index % 3 === 0 ? 'easy' : index % 3 === 1 ? 'medium' : 'hard',
    bookmarkStatus: index % 4 === 0 ? 1 : 0,
    createdAt: now - 1000 + index,
    updatedAt: now - 1000 + index
  }))
  history.forEach((entry, index) => questions.push({
    id: biology.length + index + 1,
    subjectId: 2,
    topicId: index < 3 ? 3 : 4,
    questionText: entry[0],
    options: entry[1],
    correctOptionIndex: 0,
    explanation: entry[2],
    difficulty: index % 2 === 0 ? 'easy' : 'medium',
    bookmarkStatus: index === 1 || index === 4 ? 1 : 0,
    createdAt: now - 500 + index,
    updatedAt: now - 500 + index
  }))
  await db.questions.bulkAdd(questions)
})

await page.goto('http://127.0.0.1:4173/subjects')
await page.waitForTimeout(800)
