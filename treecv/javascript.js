function toggleSection(event, id) {
    event.stopPropagation();
    const content = document.getElementById(id);
    content.classList.toggle('active');
}

// Set the dimensions and margins
const width = 2500;
const dx = 50;
const dy = width / 6;

const margin = ({top: 20, right: 150, bottom: 20, left: 150}); 
const diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);
const tree = d3.tree().nodeSize([dx, dy]);

// Create the SVG container
const svg = d3.create("svg")
    .attr("viewBox", [-margin.left, -margin.top, width, dx])
    .style("font", "16px sans-serif")
    .style("user-select", "none");

function wrap(text, width) {
    text.each(function() {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const lineHeight = 0.9;
        const dy = parseFloat(text.attr("dy"));
        let tspan = text.text(null).append("tspan")
            .attr("x", text.attr("x"))
            .attr("dy", dy + "em");

        // If text will wrap, offset the first line up
        const wouldWrap = words.join(" ").length > width;
        if (wouldWrap) {
            tspan.attr("dy", (-0.5 + dy) + "em");
        }

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan")
                    .attr("x", text.attr("x"))
                    .attr("dy", lineHeight + "em")
                    .text(word);
            }
        }
    });
}

// Load and process the data
d3.json("profile.json").then(data => {
    const root = d3.hierarchy(data);
    
    root.x0 = dy / 2;
    root.y0 = 0;
    // Keep track of nodes we want to show
    const nodesToShow = new Set(['Human Intelligence','Artificial Intelligence', 'Programming']);

    // Recursion to show specified nodes and children
    function shouldShow(node) {
        if (nodesToShow.has(node.data.name)) return true;
        return node.children?.some(child => shouldShow(child)) || false;
    }

    root.descendants().forEach((d, i) => {
        d.id = i;
        d._children = d.children;
        if (!shouldShow(d)) {
            d.children = null;
        }
    });

    const gLink = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5);

    const gNode = svg.append("g")
        .attr("cursor", "pointer")
        .attr("pointer-events", "all");

    function update(source) {
        const duration = d3.event && d3.event.altKey ? 2500 : 250;
        const nodes = root.descendants().reverse();
        const links = root.links();

        // Compute the new tree layout
        tree(root);

        let left = root;
        let right = root;
        root.eachBefore(node => {
            if (node.x < left.x) left = node;
            if (node.x > right.x) right = node;
        });

        const height = right.x - left.x + margin.top + margin.bottom;

        const transition = svg.transition()
            .duration(duration)
            .attr("viewBox", [-margin.left, left.x - margin.top, width, height])
            .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));

        // Update the nodes
        const node = gNode.selectAll("g")
            .data(nodes, d => d.id);

        // Enter any new nodes at the parent's previous position
        const nodeEnter = node.enter().append("g")
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0);

        nodeEnter.append("circle")
            .attr("r", 2.5)
            .attr("fill", d => d._children || d.children ? "#555" : "white")
            .attr("stroke", "#555")
            .attr("stroke-width", 1.5)
            .on("click", function(event, d) {
                event.stopPropagation();
                d.children = d.children ? null : d._children;
                update(d);
            });

        nodeEnter.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d._children ? -6 : 6)
            .attr("text-anchor", d => d._children ? "end" : "start")
            .attr("class", d => d.data.color ? `text-${d.data.color}` : "")
            .text(d => d.data.name + (d.data.url ? " 🔗" : ""))
            .on("click", function(event, d) {
                event.stopPropagation();
                if (d.data.url) {
                    window.open(d.data.url, "_blank");
                }
            })
            .call(wrap, 200);

        // Transition nodes to their new position
        const nodeUpdate = node.merge(nodeEnter).transition(transition)
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .attr("fill-opacity", 1)
            .attr("stroke-opacity", 1);

        // Transition exiting nodes to the parent's new position
        const nodeExit = node.exit().transition(transition).remove()
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0);

        // Update the links
        const link = gLink.selectAll("path")
            .data(links, d => d.target.id);

        // Enter any new links at the parent's previous position
        const linkEnter = link.enter().append("path")
            .attr("d", d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal({source: o, target: o});
            });

        // Transition links to their new position
        link.merge(linkEnter).transition(transition)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position
        link.exit().transition(transition).remove()
            .attr("d", d => {
                const o = {x: source.x, y: source.y};
                return diagonal({source: o, target: o});
            });

        // Stash the old positions for transition
        root.eachBefore(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Initial update
    update(root);

    document.getElementById("tree-visualization").appendChild(svg.node());
});